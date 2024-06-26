"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _index = require("event-target-shim/index");
var _reactNative = require("react-native");
var _EventEmitter = require("./EventEmitter");
var _Logger = _interopRequireDefault(require("./Logger"));
var _MediaStream = _interopRequireDefault(require("./MediaStream"));
var _MediaStreamTrack = _interopRequireDefault(require("./MediaStreamTrack"));
var _MediaStreamTrackEvent = _interopRequireDefault(require("./MediaStreamTrackEvent"));
var _RTCDataChannel = _interopRequireDefault(require("./RTCDataChannel"));
var _RTCDataChannelEvent = _interopRequireDefault(require("./RTCDataChannelEvent"));
var _RTCIceCandidate = _interopRequireDefault(require("./RTCIceCandidate"));
var _RTCIceCandidateEvent = _interopRequireDefault(require("./RTCIceCandidateEvent"));
var _RTCRtpReceiveParameters = _interopRequireDefault(require("./RTCRtpReceiveParameters"));
var _RTCRtpReceiver = _interopRequireDefault(require("./RTCRtpReceiver"));
var _RTCRtpSendParameters = _interopRequireDefault(require("./RTCRtpSendParameters"));
var _RTCRtpSender = _interopRequireDefault(require("./RTCRtpSender"));
var _RTCRtpTransceiver = _interopRequireDefault(require("./RTCRtpTransceiver"));
var _RTCSessionDescription = _interopRequireDefault(require("./RTCSessionDescription"));
var _RTCTrackEvent = _interopRequireDefault(require("./RTCTrackEvent"));
var RTCUtil = _interopRequireWildcard(require("./RTCUtil"));
function _getRequireWildcardCache(nodeInterop) { if (typeof WeakMap !== "function") return null; var cacheBabelInterop = new WeakMap(); var cacheNodeInterop = new WeakMap(); return (_getRequireWildcardCache = function (nodeInterop) { return nodeInterop ? cacheNodeInterop : cacheBabelInterop; })(nodeInterop); }
function _interopRequireWildcard(obj, nodeInterop) { if (!nodeInterop && obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(nodeInterop); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }
const log = new _Logger.default('pc');
const {
  WebRTCModule
} = _reactNative.NativeModules;
let nextPeerConnectionId = 0;
class RTCPeerConnection extends _index.EventTarget {
  constructor(configuration) {
    super();
    _defineProperty(this, "localDescription", null);
    _defineProperty(this, "remoteDescription", null);
    _defineProperty(this, "signalingState", 'stable');
    _defineProperty(this, "iceGatheringState", 'new');
    _defineProperty(this, "connectionState", 'new');
    _defineProperty(this, "iceConnectionState", 'new');
    _defineProperty(this, "_pcId", void 0);
    _defineProperty(this, "_transceivers", void 0);
    _defineProperty(this, "_remoteStreams", void 0);
    _defineProperty(this, "_pendingTrackEvents", void 0);
    this._pcId = nextPeerConnectionId++;

    // Sanitize ICE servers.
    if (configuration) {
      var _configuration$iceSer;
      const servers = (_configuration$iceSer = configuration === null || configuration === void 0 ? void 0 : configuration.iceServers) !== null && _configuration$iceSer !== void 0 ? _configuration$iceSer : [];
      for (const server of servers) {
        let urls = server.url || server.urls;
        delete server.url;
        delete server.urls;
        if (!urls) {
          continue;
        }
        if (!Array.isArray(urls)) {
          urls = [urls];
        }

        // Native WebRTC does case sensitive parsing.
        server.urls = urls.map(url => url.toLowerCase());
      }

      // Filter out bogus servers.
      configuration.iceServers = servers.filter(s => s.urls);
    }
    if (!WebRTCModule.peerConnectionInit(configuration, this._pcId)) {
      throw new Error('Failed to initialize PeerConnection, check the native logs!');
    }
    this._transceivers = [];
    this._remoteStreams = new Map();
    this._pendingTrackEvents = [];
    this._registerEvents();
    log.debug(`${this._pcId} ctor`);
  }
  async createOffer(options) {
    log.debug(`${this._pcId} createOffer`);
    const {
      sdpInfo,
      newTransceivers,
      transceiversInfo
    } = await WebRTCModule.peerConnectionCreateOffer(this._pcId, RTCUtil.normalizeOfferOptions(options));
    log.debug(`${this._pcId} createOffer OK`);
    newTransceivers === null || newTransceivers === void 0 ? void 0 : newTransceivers.forEach(t => {
      const {
        transceiverOrder,
        transceiver
      } = t;
      const newSender = new _RTCRtpSender.default({
        ...transceiver.sender,
        track: null
      });
      const remoteTrack = transceiver.receiver.track ? new _MediaStreamTrack.default(transceiver.receiver.track) : null;
      const newReceiver = new _RTCRtpReceiver.default({
        ...transceiver.receiver,
        track: remoteTrack
      });
      const newTransceiver = new _RTCRtpTransceiver.default({
        ...transceiver,
        sender: newSender,
        receiver: newReceiver
      });
      this._insertTransceiverSorted(transceiverOrder, newTransceiver);
    });
    this._updateTransceivers(transceiversInfo);
    return sdpInfo;
  }
  async createAnswer() {
    log.debug(`${this._pcId} createAnswer`);
    const {
      sdpInfo,
      transceiversInfo
    } = await WebRTCModule.peerConnectionCreateAnswer(this._pcId, {});
    this._updateTransceivers(transceiversInfo);
    return sdpInfo;
  }
  setConfiguration(configuration) {
    WebRTCModule.peerConnectionSetConfiguration(configuration, this._pcId);
  }
  async setLocalDescription(sessionDescription) {
    var _desc;
    log.debug(`${this._pcId} setLocalDescription`);
    let desc;
    if (sessionDescription) {
      var _sessionDescription$s;
      desc = {
        type: sessionDescription.type,
        sdp: (_sessionDescription$s = sessionDescription.sdp) !== null && _sessionDescription$s !== void 0 ? _sessionDescription$s : ''
      };
      if (!RTCUtil.isSdpTypeValid(desc.type)) {
        throw new Error(`Invalid session description: invalid type: ${desc.type}`);
      }
    } else {
      desc = null;
    }
    const {
      sdpInfo,
      transceiversInfo
    } = await WebRTCModule.peerConnectionSetLocalDescription(this._pcId, desc);
    if (sdpInfo.type && sdpInfo.sdp) {
      this.localDescription = new _RTCSessionDescription.default(sdpInfo);
    } else {
      this.localDescription = null;
    }
    this._updateTransceivers(transceiversInfo, /* removeStopped */((_desc = desc) === null || _desc === void 0 ? void 0 : _desc.type) === 'answer');
    log.debug(`${this._pcId} setLocalDescription OK`);
  }
  async setRemoteDescription(sessionDescription) {
    var _sessionDescription$s2, _desc$type;
    log.debug(`${this._pcId} setRemoteDescription`);
    if (!sessionDescription) {
      return Promise.reject(new Error('No session description provided'));
    }
    const desc = {
      type: sessionDescription.type,
      sdp: (_sessionDescription$s2 = sessionDescription.sdp) !== null && _sessionDescription$s2 !== void 0 ? _sessionDescription$s2 : ''
    };
    if (!RTCUtil.isSdpTypeValid((_desc$type = desc.type) !== null && _desc$type !== void 0 ? _desc$type : '')) {
      throw new Error(`Invalid session description: invalid type: ${desc.type}`);
    }
    const {
      sdpInfo,
      newTransceivers,
      transceiversInfo
    } = await WebRTCModule.peerConnectionSetRemoteDescription(this._pcId, desc);
    if (sdpInfo.type && sdpInfo.sdp) {
      this.remoteDescription = new _RTCSessionDescription.default(sdpInfo);
    } else {
      this.remoteDescription = null;
    }
    newTransceivers === null || newTransceivers === void 0 ? void 0 : newTransceivers.forEach(t => {
      const {
        transceiverOrder,
        transceiver
      } = t;
      const newSender = new _RTCRtpSender.default({
        ...transceiver.sender,
        track: null
      });
      const remoteTrack = transceiver.receiver.track ? new _MediaStreamTrack.default(transceiver.receiver.track) : null;
      const newReceiver = new _RTCRtpReceiver.default({
        ...transceiver.receiver,
        track: remoteTrack
      });
      const newTransceiver = new _RTCRtpTransceiver.default({
        ...transceiver,
        sender: newSender,
        receiver: newReceiver
      });
      this._insertTransceiverSorted(transceiverOrder, newTransceiver);
    });
    this._updateTransceivers(transceiversInfo, /* removeStopped */desc.type === 'answer');

    // Fire track events. They must fire before sRD resolves.
    const pendingTrackEvents = this._pendingTrackEvents;
    this._pendingTrackEvents = [];
    for (const ev of pendingTrackEvents) {
      const [transceiver] = this.getTransceivers().filter(t => t.receiver.id === ev.receiver.id);

      // We need to fire this event for an existing track sometimes, like
      // when the transceiver direction (on the sending side) switches from
      // sendrecv to recvonly and then back.

      // @ts-ignore
      const track = transceiver.receiver.track;
      transceiver._mid = ev.transceiver.mid;
      transceiver._currentDirection = ev.transceiver.currentDirection;
      transceiver._direction = ev.transceiver.direction;

      // Get the stream object from the event. Create if necessary.
      const streams = ev.streams.map(streamInfo => {
        // Here we are making sure that we don't create stream objects that already exist
        // So that event listeners do get the same object if it has been created before.
        if (!this._remoteStreams.has(streamInfo.streamId)) {
          const stream = new _MediaStream.default({
            streamId: streamInfo.streamId,
            streamReactTag: streamInfo.streamReactTag,
            tracks: []
          });
          this._remoteStreams.set(streamInfo.streamId, stream);
        }
        const stream = this._remoteStreams.get(streamInfo.streamId);
        if (!(stream !== null && stream !== void 0 && stream._tracks.includes(track))) {
          stream === null || stream === void 0 ? void 0 : stream._tracks.push(track);
        }
        return stream;
      });
      const eventData = {
        streams,
        transceiver,
        track,
        receiver: transceiver.receiver
      };
      this.dispatchEvent(new _RTCTrackEvent.default('track', eventData));
      streams.forEach(stream => {
        stream.dispatchEvent(new _MediaStreamTrackEvent.default('addtrack', {
          track
        }));
      });

      // Dispatch an unmute event for the track.
      track._setMutedInternal(false);
    }
    log.debug(`${this._pcId} setRemoteDescription OK`);
  }
  async addIceCandidate(candidate) {
    log.debug(`${this._pcId} addIceCandidate`);
    if (!candidate || !candidate.candidate) {
      // XXX end-of candidates is not implemented: https://bugs.chromium.org/p/webrtc/issues/detail?id=9218
      return;
    }
    if (candidate.sdpMLineIndex === null || candidate.sdpMLineIndex === undefined || candidate.sdpMid === null || candidate.sdpMid === undefined) {
      throw new TypeError('`sdpMLineIndex` and `sdpMid` must not null or undefined');
    }
    const newSdp = await WebRTCModule.peerConnectionAddICECandidate(this._pcId, candidate.toJSON ? candidate.toJSON() : candidate);
    this.remoteDescription = new _RTCSessionDescription.default(newSdp);
  }

  /**
   * @brief Adds a new track to the {@link RTCPeerConnection},
   * and indicates that it is contained in the specified {@link MediaStream}s.
   * This method has to be synchronous as the W3C API expects a track to be returned
   * @param {MediaStreamTrack} track The track to be added
   * @param {...MediaStream} streams One or more {@link MediaStream}s the track needs to be added to
   * https://w3c.github.io/webrtc-pc/#dom-rtcpeerconnection-addtrack
   */
  addTrack(track) {
    log.debug(`${this._pcId} addTrack`);
    if (this.connectionState === 'closed') {
      throw new Error('Peer Connection is closed');
    }
    if (this._trackExists(track)) {
      throw new Error('Track already exists in a sender');
    }
    for (var _len = arguments.length, streams = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      streams[_key - 1] = arguments[_key];
    }
    const streamIds = streams.map(s => s.id);
    const result = WebRTCModule.peerConnectionAddTrack(this._pcId, track.id, {
      streamIds
    });
    if (result === null) {
      throw new Error('Could not add sender');
    }
    const {
      transceiverOrder,
      transceiver,
      sender
    } = result;

    // According to the W3C docs, the sender could have been reused, and
    // so we check if that is the case, and update accordingly.
    const [existingSender] = this.getSenders().filter(s => s.id === sender.id);
    if (existingSender) {
      // Update sender
      existingSender._track = track;

      // Update the corresponding transceiver as well
      const [existingTransceiver] = this.getTransceivers().filter(t => t.sender.id === existingSender.id);
      existingTransceiver._direction = transceiver.direction;
      existingTransceiver._currentDirection = transceiver.currentDirection;
      return existingSender;
    }

    // This is a new transceiver, should create a transceiver for it and add it
    const newSender = new _RTCRtpSender.default({
      ...transceiver.sender,
      track
    });
    const remoteTrack = transceiver.receiver.track ? new _MediaStreamTrack.default(transceiver.receiver.track) : null;
    const newReceiver = new _RTCRtpReceiver.default({
      ...transceiver.receiver,
      track: remoteTrack
    });
    const newTransceiver = new _RTCRtpTransceiver.default({
      ...transceiver,
      sender: newSender,
      receiver: newReceiver
    });
    this._insertTransceiverSorted(transceiverOrder, newTransceiver);
    return newSender;
  }
  addTransceiver(source, init) {
    log.debug(`${this._pcId} addTransceiver`);
    let src = {};
    if (source === 'audio') {
      src = {
        type: 'audio'
      };
    } else if (source === 'video') {
      src = {
        type: 'video'
      };
    } else {
      src = {
        trackId: source.id
      };
    }

    // Extract the stream ids
    if (init && init.streams) {
      init.streamIds = init.streams.map(stream => stream.id);
    }
    const result = WebRTCModule.peerConnectionAddTransceiver(this._pcId, {
      ...src,
      init: {
        ...init
      }
    });
    if (result === null) {
      throw new Error('Transceiver could not be added');
    }
    const t = result.transceiver;
    let track = null;
    if (typeof source === 'string') {
      if (t.sender.track) {
        track = new _MediaStreamTrack.default(t.sender.track);
      }
    } else {
      // 'source' is a MediaStreamTrack
      track = source;
    }
    const sender = new _RTCRtpSender.default({
      ...t.sender,
      track
    });
    const remoteTrack = t.receiver.track ? new _MediaStreamTrack.default(t.receiver.track) : null;
    const receiver = new _RTCRtpReceiver.default({
      ...t.receiver,
      track: remoteTrack
    });
    const transceiver = new _RTCRtpTransceiver.default({
      ...result.transceiver,
      sender,
      receiver
    });
    this._insertTransceiverSorted(result.transceiverOrder, transceiver);
    return transceiver;
  }
  removeTrack(sender) {
    log.debug(`${this._pcId} removeTrack`);
    if (this._pcId !== sender._peerConnectionId) {
      throw new Error('Sender does not belong to this peer connection');
    }
    if (this.connectionState === 'closed') {
      throw new Error('Peer Connection is closed');
    }
    const existingSender = this.getSenders().find(s => s === sender);
    if (!existingSender) {
      throw new Error('Sender does not exist');
    }
    if (existingSender.track === null) {
      return;
    }

    // Blocking!
    WebRTCModule.peerConnectionRemoveTrack(this._pcId, sender.id);
    existingSender._track = null;
    const [existingTransceiver] = this.getTransceivers().filter(t => t.sender.id === existingSender.id);
    existingTransceiver._direction = existingTransceiver.direction === 'sendrecv' ? 'recvonly' : 'inactive';
  }
  async getStats(selector) {
    log.debug(`${this._pcId} getStats`);
    if (!selector) {
      const data = await WebRTCModule.peerConnectionGetStats(this._pcId);

      /**
       * On both Android and iOS it is faster to construct a single
       * JSON string representing the Map of StatsReports and have it
       * pass through the React Native bridge rather than the Map of
       * StatsReports. While the implementations do try to be faster in
       * general, the stress is on being faster to pass through the React
       * Native bridge which is a bottleneck that tends to be visible in
       * the UI when there is congestion involving UI-related passing.
       */
      return new Map(JSON.parse(data));
    } else {
      const senders = this.getSenders().filter(s => s.track === selector);
      const receivers = this.getReceivers().filter(r => r.track === selector);
      const matches = senders.length + receivers.length;
      if (matches === 0) {
        throw new Error('Invalid selector: could not find matching sender / receiver');
      } else if (matches > 1) {
        throw new Error('Invalid selector: multiple matching senders / receivers');
      } else {
        const sr = senders[0] || receivers[0];
        return sr.getStats();
      }
    }
  }
  getTransceivers() {
    return this._transceivers.map(e => e.transceiver);
  }
  getSenders() {
    // @ts-ignore
    return this._transceivers.map(e => !e.transceiver.stopped && e.transceiver.sender).filter(Boolean);
  }
  getReceivers() {
    // @ts-ignore
    return this._transceivers.map(e => !e.transceiver.stopped && e.transceiver.receiver).filter(Boolean);
  }
  close() {
    log.debug(`${this._pcId} close`);
    if (this.connectionState === 'closed') {
      return;
    }
    WebRTCModule.peerConnectionClose(this._pcId);

    // Mark transceivers as stopped.
    this._transceivers.forEach(_ref => {
      let {
        transceiver
      } = _ref;
      transceiver._setStopped();
    });
  }
  restartIce() {
    WebRTCModule.peerConnectionRestartIce(this._pcId);
  }
  _registerEvents() {
    (0, _EventEmitter.addListener)(this, 'peerConnectionOnRenegotiationNeeded', ev => {
      if (ev.pcId !== this._pcId) {
        return;
      }
      this.dispatchEvent(new _index.Event('negotiationneeded'));
    });
    (0, _EventEmitter.addListener)(this, 'peerConnectionIceConnectionChanged', ev => {
      if (ev.pcId !== this._pcId) {
        return;
      }
      this.iceConnectionState = ev.iceConnectionState;
      this.dispatchEvent(new _index.Event('iceconnectionstatechange'));
    });
    (0, _EventEmitter.addListener)(this, 'peerConnectionStateChanged', ev => {
      if (ev.pcId !== this._pcId) {
        return;
      }
      this.connectionState = ev.connectionState;
      this.dispatchEvent(new _index.Event('connectionstatechange'));
      if (ev.connectionState === 'closed') {
        // This PeerConnection is done, clean up.
        (0, _EventEmitter.removeListener)(this);
        WebRTCModule.peerConnectionDispose(this._pcId);
      }
    });
    (0, _EventEmitter.addListener)(this, 'peerConnectionSignalingStateChanged', ev => {
      if (ev.pcId !== this._pcId) {
        return;
      }
      this.signalingState = ev.signalingState;
      this.dispatchEvent(new _index.Event('signalingstatechange'));
    });

    // Consider moving away from this event: https://github.com/WebKit/WebKit/pull/3953
    (0, _EventEmitter.addListener)(this, 'peerConnectionOnTrack', ev => {
      if (ev.pcId !== this._pcId) {
        return;
      }
      log.debug(`${this._pcId} ontrack`);

      // NOTE: We need to make sure the track event fires right before sRD completes,
      // so we queue them up here and dispatch the events when sRD fires, but before completing it.
      // In the future we should probably implement out own logic and drop this event altogether.
      this._pendingTrackEvents.push(ev);
    });
    (0, _EventEmitter.addListener)(this, 'peerConnectionOnRemoveTrack', ev => {
      if (ev.pcId !== this._pcId) {
        return;
      }
      log.debug(`${this._pcId} onremovetrack ${ev.receiverId}`);
      const receiver = this.getReceivers().find(r => r.id === ev.receiverId);
      const track = receiver === null || receiver === void 0 ? void 0 : receiver.track;
      if (receiver && track) {
        // As per the spec:
        // - Remove the track from any media streams that were previously passed to the `track` event.
        // https://w3c.github.io/webrtc-pc/#dom-rtcpeerconnection-removetrack,
        // - Mark the track as muted:
        // https://w3c.github.io/webrtc-pc/#process-remote-track-removal
        for (const stream of this._remoteStreams.values()) {
          if (stream._tracks.includes(track)) {
            const trackIdx = stream._tracks.indexOf(track);
            log.debug(`${this._pcId} removetrack ${track.id}`);
            stream._tracks.splice(trackIdx, 1);
            stream.dispatchEvent(new _MediaStreamTrackEvent.default('removetrack', {
              track
            }));

            // Dispatch a mute event for the track.
            track._setMutedInternal(true);
          }
        }
      }
    });
    (0, _EventEmitter.addListener)(this, 'peerConnectionGotICECandidate', ev => {
      if (ev.pcId !== this._pcId) {
        return;
      }
      const sdpInfo = ev.sdp;

      // Can happen when doing a rollback.
      if (sdpInfo.type && sdpInfo.sdp) {
        this.localDescription = new _RTCSessionDescription.default(sdpInfo);
      } else {
        this.localDescription = null;
      }
      const candidate = new _RTCIceCandidate.default(ev.candidate);
      this.dispatchEvent(new _RTCIceCandidateEvent.default('icecandidate', {
        candidate
      }));
    });
    (0, _EventEmitter.addListener)(this, 'peerConnectionIceGatheringChanged', ev => {
      if (ev.pcId !== this._pcId) {
        return;
      }
      this.iceGatheringState = ev.iceGatheringState;
      if (this.iceGatheringState === 'complete') {
        const sdpInfo = ev.sdp;

        // Can happen when doing a rollback.
        if (sdpInfo.type && sdpInfo.sdp) {
          this.localDescription = new _RTCSessionDescription.default(sdpInfo);
        } else {
          this.localDescription = null;
        }
        this.dispatchEvent(new _RTCIceCandidateEvent.default('icecandidate', {
          candidate: null
        }));
      }
      this.dispatchEvent(new _index.Event('icegatheringstatechange'));
    });
    (0, _EventEmitter.addListener)(this, 'peerConnectionDidOpenDataChannel', ev => {
      if (ev.pcId !== this._pcId) {
        return;
      }
      const channel = new _RTCDataChannel.default(ev.dataChannel);
      this.dispatchEvent(new _RTCDataChannelEvent.default('datachannel', {
        channel
      }));

      // Send 'open' event. Native doesn't update the state since it's already
      // set at this point.
      channel.dispatchEvent(new _RTCDataChannelEvent.default('open', {
        channel
      }));
    });
    (0, _EventEmitter.addListener)(this, 'mediaStreamTrackMuteChanged', ev => {
      if (ev.pcId !== this._pcId) {
        return;
      }
      const [track] = this.getReceivers().map(r => r.track).filter(t => (t === null || t === void 0 ? void 0 : t.id) === ev.trackId);
      if (track) {
        track._setMutedInternal(ev.muted);
      }
    });
  }

  /**
   * Creates a new RTCDataChannel object with the given label. The
   * RTCDataChannelInit dictionary can be used to configure properties of the
   * underlying channel such as data reliability.
   *
   * @param {string} label - the value with which the label attribute of the new
   * instance is to be initialized
   * @param {RTCDataChannelInit} dataChannelDict - an optional dictionary of
   * values with which to initialize corresponding attributes of the new
   * instance such as id
   */
  createDataChannel(label, dataChannelDict) {
    if (dataChannelDict && 'id' in dataChannelDict) {
      const id = dataChannelDict.id;
      if (typeof id !== 'number') {
        throw new TypeError('DataChannel id must be a number: ' + id);
      }
    }
    const channelInfo = WebRTCModule.createDataChannel(this._pcId, label, dataChannelDict);
    if (channelInfo === null) {
      throw new TypeError('Failed to create new DataChannel');
    }
    return new _RTCDataChannel.default(channelInfo);
  }

  /**
   * Check whether a media stream track exists already in a sender.
   * See https://w3c.github.io/webrtc-pc/#dom-rtcpeerconnection-addtrack for more information
   */
  _trackExists(track) {
    const [sender] = this.getSenders().filter(sender => {
      var _sender$track;
      return ((_sender$track = sender.track) === null || _sender$track === void 0 ? void 0 : _sender$track.id) === track.id;
    });
    return sender ? true : false;
  }

  /**
   * Updates transceivers after offer/answer updates if necessary.
   */
  _updateTransceivers(transceiverUpdates) {
    let removeStopped = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
    for (const update of transceiverUpdates) {
      const [transceiver] = this.getTransceivers().filter(t => t.sender.id === update.transceiverId);
      if (!transceiver) {
        continue;
      }
      if (update.currentDirection) {
        transceiver._currentDirection = update.currentDirection;
      }
      transceiver._mid = update.mid;
      transceiver._stopped = Boolean(update.isStopped);
      transceiver._sender._rtpParameters = new _RTCRtpSendParameters.default(update.senderRtpParameters);
      transceiver._receiver._rtpParameters = new _RTCRtpReceiveParameters.default(update.receiverRtpParameters);
    }
    if (removeStopped) {
      const stopped = this.getTransceivers().filter(t => t.stopped);
      const newTransceivers = this._transceivers.filter(t => !stopped.includes(t.transceiver));
      this._transceivers = newTransceivers;
    }
  }

  /**
   * Inserts transceiver into the transceiver array in the order they are created (timestamp).
   * @param order an index that refers to when it it was created relatively.
   * @param transceiver the transceiver object to be inserted.
   */
  _insertTransceiverSorted(order, transceiver) {
    this._transceivers.push({
      order,
      transceiver
    });
    this._transceivers.sort((a, b) => a.order - b.order);
  }
}

/**
 * Define the `onxxx` event handlers.
 */
exports.default = RTCPeerConnection;
const proto = RTCPeerConnection.prototype;
(0, _index.defineEventAttribute)(proto, 'connectionstatechange');
(0, _index.defineEventAttribute)(proto, 'icecandidate');
(0, _index.defineEventAttribute)(proto, 'icecandidateerror');
(0, _index.defineEventAttribute)(proto, 'iceconnectionstatechange');
(0, _index.defineEventAttribute)(proto, 'icegatheringstatechange');
(0, _index.defineEventAttribute)(proto, 'negotiationneeded');
(0, _index.defineEventAttribute)(proto, 'signalingstatechange');
(0, _index.defineEventAttribute)(proto, 'datachannel');
(0, _index.defineEventAttribute)(proto, 'track');
(0, _index.defineEventAttribute)(proto, 'error');
//# sourceMappingURL=RTCPeerConnection.js.map