import {
  findClosestOffscreenAnchor,
  computeAnchorPositions,
  computeBuckets,
  $imports,
  BUCKET_BAR_VERTICAL_MARGIN,
} from '../buckets';

const FAKE_WINDOW_HEIGHT = 410;

describe('annotator/util/buckets', () => {
  let fakeAnchors;
  let fakeGetBoundingClientRect;
  let stubbedInnerHeight;

  let bucketBarContainer;

  beforeEach(() => {
    // In a normal `Anchor` object, `highlights` would be an array of
    // DOM elements. Here, `highlights[0]` is the vertical offset (top) of the
    // fake anchor's highlight box and `highlights[1]` is the height of the
    // box. This is in used in conjunction with the mock for
    // `getBoundingClientRect`, below.
    fakeAnchors = [
      // top: 1, bottom: 51 — above screen
      { annotation: { $tag: 't0' }, highlights: [1, 50] },
      // top: 101, bottom: 151 — above screen
      { annotation: { $tag: 't1' }, highlights: [101, 50] },
      // top: 201, bottom: 251 — on screen
      { annotation: { $tag: 't2' }, highlights: [201, 50] },
      // top: 301, bottom: 351 — on screen
      { annotation: { $tag: 't3' }, highlights: [301, 50] },
      // top: 401, bottom: 451 — below screen
      { annotation: { $tag: 't4' }, highlights: [401, 50] },
      // top: 501, bottom: 551 - below screen
      { annotation: { $tag: 't5' }, highlights: [501, 50] },
    ];

    stubbedInnerHeight = sinon
      .stub(window, 'innerHeight')
      .value(FAKE_WINDOW_HEIGHT);

    fakeGetBoundingClientRect = sinon.stub().callsFake(highlights => {
      // Use the entries of the faked anchor's `highlights` array to
      // determine this anchor's "position"
      return {
        top: highlights[0],
        bottom: highlights[0] + highlights[1],
      };
    });

    bucketBarContainer = document.createElement('div');
    bucketBarContainer.style.position = 'fixed';

    // Set the vertical position and width of the bucket bar to roughly match
    // what it will be when positioned along the edge of the sidebar.
    const topOffset = 100;
    bucketBarContainer.style.top = `${topOffset}px`;
    bucketBarContainer.style.height = `${FAKE_WINDOW_HEIGHT - topOffset}px`;
    bucketBarContainer.style.width = '25px';
    document.body.append(bucketBarContainer);

    $imports.$mock({
      '../highlighter': {
        getBoundingClientRect: fakeGetBoundingClientRect,
      },
    });
  });

  afterEach(() => {
    $imports.$restore();
    bucketBarContainer.remove();
    stubbedInnerHeight.restore();
  });

  describe('findClosestOffscreenAnchor', () => {
    it('finds the closest anchor above screen when headed up', () => {
      // fakeAnchors [0] and [1] are offscreen upwards, having `top` values
      // < BUCKET_TOP_THRESHOLD. [1] is closer so wins out. [3] and [4] are
      // "onscreen" already, or below where we want to go, anyway.
      assert.equal(
        findClosestOffscreenAnchor(fakeAnchors, 'up'),
        fakeAnchors[1]
      );
    });

    it('finds the closest anchor below screen when headed down', () => {
      // Our faked window.innerHeight here is 410, but the fake anchor with
      // top: 400 qualifies because it falls within BUCKET_NAV_SIZE of
      // the bottom of the window. It's closer to the screen than the last
      // anchor.
      assert.equal(
        findClosestOffscreenAnchor(fakeAnchors, 'down'),
        fakeAnchors[4]
      );
    });

    it('finds the right answer regardless of anchor order', () => {
      assert.equal(
        findClosestOffscreenAnchor(
          [fakeAnchors[3], fakeAnchors[1], fakeAnchors[4], fakeAnchors[0]],
          'up'
        ),
        fakeAnchors[1]
      );

      assert.equal(
        findClosestOffscreenAnchor(
          [fakeAnchors[4], fakeAnchors[2], fakeAnchors[3]],
          'down'
        ),
        fakeAnchors[4]
      );
    });

    it('ignores anchors with no highlights', () => {
      fakeAnchors.push({ highlights: [] });
      findClosestOffscreenAnchor(fakeAnchors, 'down');
      // It will disregard the anchor without the highlights and not try to
      // assess its boundingRect
      assert.equal(fakeGetBoundingClientRect.callCount, fakeAnchors.length - 1);
    });

    it('returns null if no valid anchor found', () => {
      stubbedInnerHeight = sinon.stub(window, 'innerHeight').value(800);
      assert.isNull(findClosestOffscreenAnchor([{ highlights: [] }], 'down'));
      assert.isNull(findClosestOffscreenAnchor(fakeAnchors, 'down'));
    });
  });

  describe('computeAnchorPositions', () => {
    it('ignores anchors with no highlights', () => {
      const anchorPositions = computeAnchorPositions([
        { highlights: undefined },
        {},
        { highlights: [] },
      ]);

      assert.lengthOf(anchorPositions, 0);
    });

    it('ignores anchors if highlights have zero area', () => {
      const anchorPositions = computeAnchorPositions([{ highlights: [60, 0] }]);

      assert.lengthOf(anchorPositions, 0);
    });

    it('computes anchor positions', () => {
      const anchorPositions = computeAnchorPositions(fakeAnchors.slice(0, 2));

      assert.deepEqual(anchorPositions, [
        {
          tag: 't0',
          top: 1,
          bottom: 51,
        },
        {
          tag: 't1',
          top: 101,
          bottom: 151,
        },
      ]);
    });

    it('computes anchor positions sorted vertically', () => {
      const anchors1 = [...fakeAnchors];
      const anchors2 = [...fakeAnchors];

      anchors2.reverse();

      assert.deepEqual(
        computeAnchorPositions(anchors1),
        computeAnchorPositions(anchors2)
      );
    });
  });

  describe('computeBuckets', () => {
    let fakeAnchorPositions;

    beforeEach(() => {
      fakeAnchorPositions = [
        // Above-screen anchors.
        {
          tag: 't0',
          top: 1,
          bottom: 51,
        },
        {
          tag: 't1',
          top: 101,
          bottom: 151,
        },
        // On-screen anchors.
        {
          tag: 't2',
          top: 201,
          bottom: 251,
        },
        {
          tag: 't3',
          top: 301,
          bottom: 351,
        },
        // Below-screen anchors.
        {
          tag: 't4',
          top: 401,
          bottom: 451,
        },
        {
          tag: 't5',
          top: 501,
          bottom: 551,
        },
      ];
    });

    it('puts anchors whose center is above the container into the `above` bucket', () => {
      const thresholdPos =
        bucketBarContainer.getBoundingClientRect().top +
        BUCKET_BAR_VERTICAL_MARGIN;

      const bucketSet = computeBuckets(
        [
          ...fakeAnchorPositions,
          {
            tag: 'just-on-screen',
            top: thresholdPos - 10,
            bottom: thresholdPos + 11,
          },
          {
            tag: 'just-off-screen',
            top: thresholdPos - 11,
            bottom: thresholdPos + 10,
          },
        ],
        bucketBarContainer
      );

      assert.deepEqual(
        [...bucketSet.above.tags],
        ['t0', 't1', 'just-off-screen']
      );
    });

    it('puts anchors whose center is below the container into the `below` bucket', () => {
      const thresholdPos =
        bucketBarContainer.getBoundingClientRect().bottom -
        BUCKET_BAR_VERTICAL_MARGIN;

      const bucketSet = computeBuckets(
        [
          ...fakeAnchorPositions,
          {
            tag: 'just-on-screen',
            top: thresholdPos - 11,
            bottom: thresholdPos + 10,
          },
          {
            tag: 'just-off-screen',
            top: thresholdPos - 10,
            bottom: thresholdPos + 11,
          },
        ],
        bucketBarContainer
      );

      assert.deepEqual(
        [...bucketSet.below.tags],
        ['t4', 't5', 'just-off-screen']
      );
    });

    it('puts on-screen anchors into a buckets', () => {
      const bucketSet = computeBuckets(fakeAnchorPositions, bucketBarContainer);
      assert.deepEqual([...bucketSet.buckets[0].tags], ['t2', 't3']);
    });

    it('puts anchors into separate buckets if more than 60px separates their boxes', () => {
      fakeAnchorPositions[2].bottom = 216;
      fakeAnchorPositions[3].top = 301; // more than 60px from 216

      const bucketSet = computeBuckets(fakeAnchorPositions, bucketBarContainer);

      assert.deepEqual([...bucketSet.buckets[0].tags], ['t2']);
      assert.deepEqual([...bucketSet.buckets[1].tags], ['t3']);
    });

    it('puts overlapping anchors into a shared bucket', () => {
      fakeAnchorPositions[2].bottom = 401;
      fakeAnchorPositions[3].bottom = 385;
      const bucketSet = computeBuckets(fakeAnchorPositions, bucketBarContainer);
      assert.deepEqual([...bucketSet.buckets[0].tags], ['t2', 't3']);
    });

    it('positions the bucket at vertical midpoint of the box containing all bucket anchors', () => {
      fakeAnchorPositions[2].top = 200;
      fakeAnchorPositions[2].bottom = 250;
      fakeAnchorPositions[3].top = 225;
      fakeAnchorPositions[3].bottom = 300;

      const bucketSet = computeBuckets(fakeAnchorPositions, bucketBarContainer);

      const expected =
        (fakeAnchorPositions[2].top + fakeAnchorPositions[3].bottom) / 2 -
        bucketBarContainer.getBoundingClientRect().top;

      assert.equal(bucketSet.buckets[0].position, expected);
    });

    it('returns only above- and below-screen anchors if none are on-screen', () => {
      // Push these anchors below screen
      [2, 3, 4, 5].forEach(index => {
        fakeAnchorPositions[index].top += 1000;
        fakeAnchorPositions[index].bottom += 1000;
      });

      const bucketSet = computeBuckets(fakeAnchorPositions, bucketBarContainer);

      assert.equal(bucketSet.buckets.length, 0);
      // Above-screen
      assert.deepEqual([...bucketSet.above.tags], ['t0', 't1']);
      // Below-screen
      assert.deepEqual([...bucketSet.below.tags], ['t2', 't3', 't4', 't5']);
    });
  });
});
