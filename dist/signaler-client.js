/* globals define, module, require */
/** 
 * Socket Signaler Client
 * Version: 0.0.1
 * GitHub: https://github.com/mcmouse/socketio-signaler-client
 **/

(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define(['https://cdnjs.cloudflare.com/ajax/libs/EventEmitter/4.2.11/EventEmitter.min.js', 'https://cdn.socket.io/socket.io-1.3.3.js'], function (EventEmitter, io) {
      return factory(window, EventEmitter, io);
    });
  } else if (typeof exports === 'object') {
    module.exports = factory(window, require('wolfy87-eventemitter'), require('socket.io-client'));
  } else {
    root.SignallerPeerConnection = factory(window, root.EventEmitter, root.io);
  }
}(this, function factory(window, EventEmitter, io) {
  'use strict';

  function SignallerPeerConnection(options) {

    //Generate our option defaults
    this.generateDefaults = function (options) {
      options = options || {};
      options.server = options.server || 'http://' + window.location.host + '/';
      options.room = options.room || 'default';
      options.debug = options.debug || false;
      return options;
    };

    this.peerConnections = [];

    if (navigator.mozGetUserMedia) {
      //Set constraints to properly negotiate connection
      this.constraints = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      };
    } else {
      //Set constraints to properly negotiate connection
      this.constraints = {
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true
        },
      };
    }

    //Declare our public STUN server
    this.iceServers = {
      'iceServers': [{
        'url': 'stun:stun.services.mozilla.com'
      }, {
        'url': 'stun:stun.l.google.com:19302'
      }]
    };

    //Set up our prefixed defaults
    this.setupRTCObjects = function () {
      //PeerConnection
      this.PeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;

      //SessionDescription
      this.SessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;

      //GetUserMedia
      navigator.getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);

      //RTCIceCandidate
      this.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate;
    };

    //Set up our event handlers
    this.bindEvents = function () {
      this.socket.on('initialized', this.getPeerList.bind(this));
      this.socket.on('list', this.generateConnections.bind(this));
      this.socket.on('offer', this.createAnswer.bind(this));
      this.socket.on('answer', this.handleAnswer.bind(this));
      this.socket.on('icecandidate', this.receiveIceCandidate.bind(this));
      this.socket.on('newconnection', this.addPeer.bind(this));
      this.socket.on('disconnect', this.disconnectConnection.bind(this));
      this.socket.on('peerconnected', this.peerConnected.bind(this));
      this.socket.on('streamremoved', this.removeRemoteStream.bind(this));
    };

    //Request our list of peers - all other users connected to the socket.io room
    this.getPeerList = function () {
      this.socket.emit('list');
    };

    //Generate our PeerConnections for each user received by getPeerList
    this.generateConnections = function (peers) {
      if (options.debug) console.log('Received list, creating connection(s) for ' + peers.length + ' peers');
      //Create a new connection for each peer
      peers.forEach(this.addPeer.bind(this));
    };

    //Add a peer to our connections, initializing the PeerConnection object
    //and sending an offer if we are currently broadcasting
    this.addPeer = function (id, suppress) {

      if (!this.hasPeer(id)) {
        console.log('Adding peer: ' + id);

        //Create new peer
        var peer = {
          connection: new this.PeerConnection(this.iceServers),
          id: id,
        };

        //Bind events
        peer = this.bindConnectionEvents(peer, suppress);

        //Add peer to array of connections
        this.peerConnections.push(peer);

        //If we are currently broadcasting, broadcast our stream to the newly added peer
        if (this.localStream) {
          this.addStreamToPeer(this.localStream, peer);
        }
        return peer;
      }

    };

    //Bind our PeerConnection events
    //Not using "onremovestream" because it seems to be in a buggy state - 
    //returning nonexistant remote connections on renegotiation
    this.bindConnectionEvents = function (peer, suppress) {
      if (options.debug) console.log('Binding connection events for peer: ' + peer.id);

      //Send ice candidate to peer
      peer.connection.onicecandidate = function (event) {
        if (options.debug && options.debug === 'verbose') console.log('Sending ICE candidate to ' + peer.id);
        if (options.debug && options.debug === 'verbose') console.log('Full event ', event);
        if (options.debug && options.debug === 'verbose') console.log('Stringified event ', JSON.stringify(event));

        console.log(Object.keys(event));

        if (event.candidate) {
          this.socket.emit('icecandidate', {
            target: peer.id,
            candidate: event.candidate
          });
        }


      }.bind(this);

      //When connection succeeds after stream is added, proxy event
      peer.connection.onaddstream = function (event) {
        //Checking suppress because if a connection is renegotiated and the remote maintains a 
        //stream, onaddstream will be fired twice
        if (options.debug) console.log('Remote stream added from ' + peer.id);
        if (!suppress) {
          this.emit('remoteStreamAdded', event.stream, peer.id);
        } else {
          if (options.debug) console.log('onaddstream event suppressed');
        }
      }.bind(this);

      //Untested
      peer.connection.ondatachannel = function (event) {
        if (options.debug) console.log('Data channel added from ' + peer.id);
        this.emit('dataChannelAdded', event.channel, peer.id);
      }.bind(this);

      //Don't add unnecessary ICE candidates.
      //On Ice error, close the connection
      peer.connection.oniceconnectionstatechange = function () {
        switch (peer.connection.iceConnectionState) {
        case 'disconnected':
        case 'failed':
          this.logError('iceConnectionState is disconnected, closing connections to ' + peer.id);
          peer.connection.close();
          break;
        case 'completed':
          peer.connection.onicecandidate = function () {};
          break;
        }
      }.bind(this);

      return peer;
    };

    //Create our offer and set our local session description
    this.createOffer = function (peer) {

      if (options.debug) console.log('Creating offer for: ' + peer.id);

      //Create our offer
      peer.connection.createOffer(function (offer) {

        //Set local description from offer
        peer.connection.setLocalDescription(new this.SessionDescription(offer),

          //Send offer
          this.sendOffer({
            target: peer.id,
            offer: offer
          }), this.logError);

        //Pass constraints 
      }.bind(this), this.logError, this.constraints);
    };

    //Send offer to server
    this.sendOffer = function (offer) {
      if (options.debug) console.log('Sending offer to ' + offer.target);
      this.socket.emit('offer', offer);
    };

    //Set remote and local session description
    this.createAnswer = function (data) {

      //Retreive peer from this.peerConnections and set offer
      var peer = this.getPeer(data.sender),
        offer = data.offer;

      if (options.debug) console.log('Creating answer for ' + peer.id);

      //Set remote description from offer
      peer.connection.setRemoteDescription(new this.SessionDescription(offer), function () {

        //Callback after remote description set
        peer.connection.createAnswer(function (answer) {

          //Callback after answer created to set the local description
          peer.connection.setLocalDescription(new this.SessionDescription(answer),
            //Send answer back to peer
            this.sendAnswer({
              target: peer.id,
              answer: answer
            }), this.logError);

          //Set constraints for answer
        }.bind(this), this.logError, this.constraints);

        //Error logging for setRemoteDescription
      }.bind(this), this.logError);
    };

    //Send answer to server
    this.sendAnswer = function (answer) {
      if (options.debug) console.log('Sent answer to peer: ' + answer.target);
      this.socket.emit('answer', answer);
    };

    //Handle the answer received from peer
    this.handleAnswer = function (data) {
      var peer = this.getPeer(data.sender),
        answer = data.answer;

      if (options.debug) console.log('Handling answer from: ' + peer.id);

      //Set remote description
      peer.connection.setRemoteDescription(new this.SessionDescription(answer),

        //Trigger peer connected and emit to let peer know that we're good
        function () {
          this.peerConnected(peer.id);
          this.socket.emit('peerconnected', peer.id);
        }.bind(this), this.logError);
    };

    //Event fired when our peer is connected
    this.peerConnected = function (id) {
      this.emit('peerConnected', id);
      if (options.debug) console.log('Signaling with peer: ' + id);
    };

    //Disconnect a peer
    this.disconnectConnection = function (id) {

      //Get our peer
      var peer = this.getPeer(id);

      //Close connection
      peer.connection.close();

      //Proxy events out
      this.emit('peerDisconnected', id);
      this.emit('remoteStreamRemoved', id);
      if (options.debug) console.log('Disconnected with peer: ' + id);

      //Remove peer from internal array
      this.peerConnections.forEach(function (peer, index, peers) {
        if (peer.id === id) {
          peers.splice(index, 1);
        }
      });
    };

    //Find a peer by ID
    this.getPeer = function (id) {
      var foundPeer;

      //Match based on ID
      this.peerConnections.forEach(function (peer) {
        if (peer.id === id) {
          foundPeer = peer;
        }
      });

      //Create peer if it doesn't exist
      if (!foundPeer) {
        foundPeer = this.addPeer(id);
      }

      return foundPeer;
    };

    //Check if a peer exists based on ID
    this.hasPeer = function (id) {
      var foundPeer = false;
      this.peerConnections.forEach(function (peer) {
        if (peer.id === id) {
          foundPeer = true;
        }
      });

      return foundPeer;
    };

    //Log errors
    this.logError = function (error) {
      if (options.debug) console.error(error);
      else console.error('There was an error with the signaller');
    };

    //Add stream to all connections
    this.addStream = function (stream) {
      this.peerConnections.forEach(function (peer) {
        this.addStreamToPeer(stream, peer);
      }.bind(this));
    };

    //Add stream to single connection
    this.addStreamToPeer = function (stream, peer) {
      if (options.debug) console.log('Stream added to ' + peer.id);
      peer.connection.addStream(stream);

      //Need to renegotiate after a stream is added
      this.createOffer(peer);
    };

    //Add local webcam and/or microphone stream
    //Toggle video with opts.video and audio with opts.audio
    this.addLocalStream = function (opts) {
      opts = opts || {};
      //Request access
      navigator.getUserMedia({
        audio: opts.audio || true,
        video: opts.video || true,
        //Add stream to PeerConnection
      }, function (stream) {
        //Reference to our stream
        this.localStream = stream;

        //Add stream to all peers
        this.addStream(stream);

        //Proxy stream added event
        this.emit('localStreamAdded', stream);
        if (options.debug) console.log('Local stream added');
      }.bind(this), this.logError);
    };

    //Remove stream from all connections
    this.removeLocalStream = function () {
      //Stop recording
      this.localStream.stop();

      //Remove our local stream entirely
      this.localStream = undefined;

      this.peerConnections.forEach(function (peer) {
        if (options.debug) console.log('Local stream removed from ' + peer.id);

        this.socket.emit('streamremoved', peer.id);

        //Demolish stream
        this.regenStream(peer, true);

      }.bind(this));

      //Pass events through
      this.emit('localStreamRemoved');

    };

    //Remove stream
    this.removeRemoteStream = function (id) {
      this.emit('remoteStreamRemoved', id);
      if (options.debug) console.log('Removing stream from: ' + id);

      //Need to regenerate stream to deal with "phantom" remote MediaStream bug(?)
      this.regenStream(this.getPeer(id));
    };

    //Regenerate a stream by re-creating its PeerConnection and re-binding all events
    this.regenStream = function (peer, suppress) {

      if (options.debug) console.log('Regenerating PeerConnection for ' + peer.id);

      //If we are regenerating because we're removing a local connection and there is a remote stream
      suppress = suppress && peer.connection.getRemoteStreams().length;
      //Replace PeerConnection with new connection
      peer.connection = new this.PeerConnection(this.iceServers);
      //Bind connection events
      this.bindConnectionEvents(peer, suppress);
      //Add local stream if necessary
      if (this.localStream) {
        this.addStreamToPeer(this.localStream, peer);
      }
    };

    //Process ice candidate
    this.receiveIceCandidate = function (data) {

      if (options.debug && options.debug === 'verbose') console.log('Received candidate', data.candidate);

      //This is horrible, but that's the way the data is packaged
      if (data.candidate.candidate) {

        //Unpackage data
        var peer = this.getPeer(data.sender),
          candidate = data.candidate.candidate,
          line = data.candidate.sdpMLineIndex;

        if (options.debug && options.debug === 'verbose') console.log('Added ICE candidate from ' + peer.id);

        //Suppress error message if we're debugging after unnecessary ice candidates are sent - causes like 30 errors if you pause during connection
        peer.connection.addIceCandidate(new this.RTCIceCandidate({
          candidate: candidate,
          sdpMLineIndex: line,
        }));
      }
    };

    //Get our prefixed RTC objects
    this.setupRTCObjects();

    //Options defaults
    options = this.generateDefaults(options);

    //Set up our socket connection
    this.socket = io(options.server + options.room);

    //Bind our events
    this.bindEvents();
  }

  SignallerPeerConnection.prototype = new EventEmitter();

  return SignallerPeerConnection;
}));