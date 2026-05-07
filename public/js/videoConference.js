class VideoConference {
  constructor(roomId, userId, username, isTeacher) {
    this.roomId = roomId;
    this.userId = userId;
    this.username = username;
    this.isTeacher = isTeacher;
    this.peers = new Map();
    this.localStream = null;
    this.socket = io();
    
    this.videoGrid = document.getElementById('video-grid');
    this.setupSocketListeners();
  }

  async init() {
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      this.addVideoStream(this.localStream, this.userId, true);
      this.socket.emit('join-room', {
        roomId: this.roomId,
        userId: this.userId,
        username: this.username,
        isTeacher: this.isTeacher
      });
    } catch (error) {
      console.error('Error accessing media devices:', error);
      alert('Unable to access camera and microphone. Please check your permissions.');
    }
  }

  setupSocketListeners() {
    this.socket.on('user-connected', ({ userId, username, isTeacher }) => {
      console.log('User connected:', username);
      this.connectToNewUser(userId, username, isTeacher);
    });

    this.socket.on('user-disconnected', (userId) => {
      if (this.peers.has(userId)) {
        this.peers.get(userId).close();
        this.peers.delete(userId);
        this.removeVideoElement(userId);
      }
    });

    this.socket.on('room-users', (users) => {
      users.forEach(user => {
        if (user.userId !== this.userId && !this.peers.has(user.userId)) {
          this.connectToNewUser(user.userId, user.username, user.isTeacher);
        }
      });
    });

    this.socket.on('user-signal', ({ userId, signal }) => {
      if (this.peers.has(userId)) {
        this.peers.get(userId).signal(signal);
      }
    });
  }

  connectToNewUser(userId, username, isTeacher) {
    const peer = new SimplePeer({
      initiator: true,
      stream: this.localStream
    });

    peer.on('signal', (signal) => {
      this.socket.emit('signal', { userId, signal });
    });

    peer.on('stream', (stream) => {
      this.addVideoStream(stream, userId, false, username, isTeacher);
    });

    this.peers.set(userId, peer);
  }

  addVideoStream(stream, userId, isLocal = false, username = '', isTeacher = false) {
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    videoContainer.id = `video-${userId}`;

    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    if (isLocal) video.muted = true;

    const nameTag = document.createElement('div');
    nameTag.className = 'name-tag';
    nameTag.textContent = isLocal ? `You ${isTeacher ? '(Teacher)' : ''}` : 
                                   `${username} ${isTeacher ? '(Teacher)' : ''}`;

    const controls = document.createElement('div');
    controls.className = 'video-controls';

    const muteBtn = document.createElement('button');
    muteBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    muteBtn.onclick = () => this.toggleAudio(video, muteBtn);

    const videoBtn = document.createElement('button');
    videoBtn.innerHTML = '<i class="fas fa-video"></i>';
    videoBtn.onclick = () => this.toggleVideo(video, videoBtn);

    controls.appendChild(muteBtn);
    controls.appendChild(videoBtn);

    videoContainer.appendChild(video);
    videoContainer.appendChild(nameTag);
    videoContainer.appendChild(controls);

    this.videoGrid.appendChild(videoContainer);
  }

  removeVideoElement(userId) {
    const videoElement = document.getElementById(`video-${userId}`);
    if (videoElement) {
      videoElement.remove();
    }
  }

  toggleAudio(video, button) {
    const tracks = video.srcObject.getAudioTracks();
    tracks.forEach(track => {
      track.enabled = !track.enabled;
      button.innerHTML = track.enabled ? 
        '<i class="fas fa-microphone"></i>' : 
        '<i class="fas fa-microphone-slash"></i>';
    });
  }

  toggleVideo(video, button) {
    const tracks = video.srcObject.getVideoTracks();
    tracks.forEach(track => {
      track.enabled = !track.enabled;
      button.innerHTML = track.enabled ? 
        '<i class="fas fa-video"></i>' : 
        '<i class="fas fa-video-slash"></i>';
    });
  }

  endCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }
    this.peers.forEach(peer => peer.destroy());
    this.peers.clear();
    this.socket.disconnect();
  }
} 