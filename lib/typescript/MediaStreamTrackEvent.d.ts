import { Event } from 'event-target-shim/index';
import type MediaStreamTrack from './MediaStreamTrack';
declare type MEDIA_STREAM_EVENTS = 'addtrack' | 'removetrack';
interface IMediaStreamTrackEventInitDict extends Event.EventInit {
    track: MediaStreamTrack;
}
/**
 * @eventClass
 * This event is fired whenever the MediaStreamTrack has changed in any way.
 * @param {MEDIA_STREAM_EVENTS} type - The type of event.
 * @param {IMediaStreamTrackEventInitDict} eventInitDict - The event init properties.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MediaStream#events MDN} for details.
 */
export default class MediaStreamTrackEvent<TEventType extends MEDIA_STREAM_EVENTS> extends Event<TEventType> {
    /** @eventProperty */
    track: MediaStreamTrack;
    constructor(type: TEventType, eventInitDict: IMediaStreamTrackEventInitDict);
}
export {};
