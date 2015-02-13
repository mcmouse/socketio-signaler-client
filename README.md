#Socket.IO Signaler Client
---

This package is intended to be used as the client component of the [Socket.IO Signaler](https://github.com/mcmouse/socketio-signaler) package. It was written in order to interface with a websockets based signaling server and wrap the WebRTC negotiation and GetUserMedia process, offering up a sensible event API.

An important difference between this package and similar WebRTC solutions is that it's built on an exposed [Socket.IO](http://socket.io) socket. This allows you to use the same connection for both chat and webcams in instances where you would like to host your own signaling server.

I will mention that this package was written as an exploration into WebRTC by me. I make no promises as to lifespan or maintenance. I welcome any comments or critiques of the coding style. 

For robust, actively-maintained WebRTC helper libraries, I recommend [peer.js](http://peerjs.com/), [rtc.io](https://rtc.io/), and [TemaSys SkyLink](https://temasys.github.io/).

The Signaler Client is only compatible with recent versions of browsers that have implemented WebRTC - Chrome, Firefox, and Opera at time of writing.

##Getting Started
---

The Socket.IO Signaler Client is compatible with vanilla JavaScript and Bower as well as AMD-style ([RequireJS](http://requirejs.org/)) and CommonJS-style ([Browserify](http://browserify.org/)) module systems.

It is dependent on the [Socket.IO](http://socket.io/) client library and the excellent [EventEmitter](https://github.com/Wolfy87/EventEmitter) prototype. Both are packaged with the CommonJS include style and are loaded from CDN in the AMD-style include.

You can grab the minified file from the `dist` folder, or install the whole package with `Bower` or `NPM`. You should only use the packaged file if you are using Browserify or another CommonJS module loader:

###Installation

  //Install package with Bower
  bower install --save socket-signaler-client

  //Install package with NPM
  npm install --save socket-signaler-client

####Pure JavaScript
  //Include dependencies
  <script src="https://cdn.socket.io/socket.io-1.3.3.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/EventEmitter/4.2.11/EventEmitter.min.js"></script>

  //Include client
  <script src="libs/signaler-client.min.js"></script>

####CommonJS (Browserify)
  //Include constructor
  //Dependencies are packaged
  var PeerConnectionClient = require('socket-signaler-client');

####AMD (RequireJS)
  //Add path to module to your Require config
  //Dependencies are loaded from CDN
  require.config({
    ...
    paths: {
      ...
      PeerConnectionClient: 'libs/signaler-client',
    },
  });

  //Pass module into any modules where it is used
  require(['PeerConnectionClient'], function (PeerConnectionClient) {
    //Constructor available here
  }

###Intitialization
  var pc = new PeerConnectionClient(options);
  //Can use pc to bind to connection lifecycle events here

###Simple webcam call
  pc.on('localStreamAdded', function (stream) {
    var local = $('#local')[0];
    local.src = URL.createObjectURL(stream);
  });

  pc.on('remoteStreamAdded', function (stream, peer) {
    var element = videoTemplate.clone();
    element.attr({
      'class': peer,
      'src': URL.createObjectURL(stream)
    });
    $('#remotes').append(element);
  });

  pc.on('localStreamRemoved', function () {
    var local = $('#local')[0];
    local.src = '';
  });

  pc.on('remoteStreamRemoved', function (peer) {
    var remote = $('.' + peer);
    remote.remove();
  });

  $('#show').on('click', function () {
    spc.addLocalStream();
  });

  $('#hide').on('click', function () {
    spc.removeLocalStream();
  });

##Options
---

These options can be passed in to the PeerConnectionClient constructor

`server` - Where the signaling WebSockets server is located.
Default: Current host root. So if you run the PeerConnectionClient from `http://localhost:3000/`, the PeerConnectionClient will try to connect to the WS server there.

`room` - The room that will be the context for connecting to peers. Your client will connect to all other clients in this room.
Default: `default`

`debug` - Whether to console log negotiation events. Acceptable values are `false`, `true`, or `"verbose"`, which will log full ICE connections.
Default: `false`

##API
---

###Events

The PeerConnectionClient is an EventEmitter, meaning that you can use `on()`, `emit()`, and `trigger()` to listen to and fire events. There are several default events used to listen to the negotiation cycle, as well as many signaling events used to communicate with the signaling server.

`.on('localStreamAdded', function(stream){})`
Triggered when the local user has successfully added a stream to their local PeerConnections. Called with the [MediaStream](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream) object that was captured. This object can be added to `<video>` elements.

`.on('remoteStreamAdded', function(stream, peer){})`
Triggered when a peer has successfully added a stream to their PeerConnection. Called with the [MediaStream](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream) object that was captured and the peer's unique ID.

`.on('localStreamRemoved', function(){})`
Triggered when the local stream has been removed.

`.on('remoteStreamRemoved', function(peer){})`
Triggered when a remote stream has been removed. Called with the peer's unique ID.

`.on('peerConnected', function(peer){})`
Triggered when a peer has established and negotiated a PeerConnection. Can be used to add DataChannels, or just keep a list of users. Called with the peer's unique ID.

`.on('peerDisconnected', function(peer){})`
Triggered when a peer has disconnected. Can be used to keep track of which users are currently conected. Called with the peer's unique ID.

... Coming soon: DataChannels!

###Methods
---

The PeerConnectionClient exposes many methods for interacting with peers connected to the WebSockets room.

`addLocalStream(options)`
Calls [GetUserMedia](https://developer.mozilla.org/en-US/docs/NavigatorUserMedia.getUserMedia) to capture the browser's webcam and microphone. Passes through all standard GetUserMedia options, so can be used to capture just audio or video if necessary. Will trigger a user prompt asking for permission to access webcam and microphone.

`removeLocalStream()`
Removes the local stream from all PeerConnections and revoke microphone and video access.

`disconnectConnection(id)`
Disconnects a peer with the given ID, closing and removing the PeerConnection. If the connection had a MediaStream, it will also close and remove the stream.

###License
---

Copyright (c) 2015 Tom Lagier <tom@thomaslagier.me>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.