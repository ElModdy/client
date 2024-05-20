import type { SidebarStore } from '../store';
import { retryPromiseOperation } from '../util/retry';
import type { AnnotationsService } from './annotations';
import type { ToastMessengerService } from './toast-messenger';

/**
 * A service for automatically saving new highlights.
 *
 * @inject
 */
export class AutosaveService {
  private _annotationsService: AnnotationsService;
  private _toastMessenger: ToastMessengerService;
  private _store: SidebarStore;

  /** A set of annotation $tags that have save requests in-flight */
  private _saving: Set<string>;
  /** A set of annotation $tags that have failed to save after retries */
  private _failed: Set<string>;

  constructor(
    annotationsService: AnnotationsService,
    toastMessenger: ToastMessengerService,
    store: SidebarStore,
  ) {
    this._annotationsService = annotationsService;
    this._toastMessenger = toastMessenger;
    this._store = store;

    this._saving = new Set();
    this._failed = new Set();
  }

  /**
   * Begin watching the store for new unsaved highlights and save them in
   * response.
   */
  init() {
    /**
     * Determine whether we should try to send a save request for the highlight
     * indicated by `htag`
     *
     * @param htag - The local unique identifier for the unsaved highlight
     */
    const shouldSaveHighlight = (htag: string): boolean => {
      return !this._saving.has(htag) && !this._failed.has(htag);
    };

    /**
     * Store-subscribed call back. Automatically save new highlights.
     */
    const autosaveNewHighlights = () => {
      const newHighlights = this._store.newHighlights();

      newHighlights.forEach(async highlight => {
        // Because this is a new annotation object, it does not yet have an `id`
        // property. Use the local `$tag` for uniqueness instead.
        const htag = highlight.$tag;

        if (!shouldSaveHighlight(htag)) {
          return;
        }

        this._saving.add(htag);

        try {
          const savedAnnotation = await retryPromiseOperation(() => this._annotationsService.save(highlight));
          if(savedAnnotation.links.incontext !== undefined) {
            this._toastMessenger.copy_to_clipboard(savedAnnotation.links.incontext);
          }
        } catch (error) {
          this._failed.add(htag);
        } finally {
          this._saving.delete(htag);
        }

      })
    }

    this._store.subscribe(autosaveNewHighlights);
  }

  /**
   * Return `true` if any new highlights are currently being saved.
   */
  isSaving() {
    return this._saving.size > 0;
  }
}
