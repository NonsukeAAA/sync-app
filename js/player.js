/**
 * SyncApp メディアプレーヤーモジュール
 * 個人用歌詞同期アプリ
 */

const Player = {
    player: null,           // プレーヤーインスタンス
    playerType: null,       // プレーヤータイプ (youtube, niconico, audio)
    currentSong: null,      // 現在の曲データ
    isEditing: false,       // 編集モードかどうか
    timeUpdateInterval: null, // 時間更新のインターバル
    currentLyricIndex: -1,  // 現在の歌詞インデックス
    audioElement: null,     // Audio要素（ローカルファイル用）
    isDragging: false,      // シークバードラッグ中かどうか

    // プレーヤーの初期化（編集用）
    initForEditing: function(song) {
        this.cleanUp(); // 既存のプレーヤーをクリーンアップ
        
        this.currentSong = song;
        this.isEditing = true;
        
        const playerContainer = document.getElementById('timing-media-player');
        playerContainer.innerHTML = ''; // コンテナをクリア
        
        // 音源タイプに応じてプレーヤーを初期化
        switch (song.sourceType) {
            case 'youtube':
                this.initYouTubePlayer(song.sourceId, playerContainer.id);
                break;
            case 'niconico':
                this.initNiconicoPlayer(song.sourceId, playerContainer.id);
                break;
            case 'local':
                this.initAudioPlayer(song.sourceUrl, playerContainer);
                break;
        }
        
        // 時間更新用インターバルを設定
        this.setupTimeUpdateInterval();
    },

    // プレーヤーの初期化（再生用）
    initForPlayback: function(song) {
        this.cleanUp(); // 既存のプレーヤーをクリーンアップ
        
        this.currentSong = song;
        this.isEditing = false;
        this.currentLyricIndex = -1;
        
        const playerContainer = document.getElementById('playback-media-player');
        playerContainer.innerHTML = ''; // コンテナをクリア
        
        // まずキャッシュを確認
        const cachedMedia = this.checkMediaCache(song);
        
        if (cachedMedia) {
            // キャッシュがある場合はそれを使用
            this.initCachedMedia(cachedMedia, playerContainer);
        } else {
            // キャッシュがない場合は通常の初期化
            // 音源タイプに応じてプレーヤーを初期化
            switch (song.sourceType) {
                case 'youtube':
                    this.initYouTubePlayer(song.sourceId, playerContainer.id);
                    // 可能ならキャッシュも同時に進める
                    this.cacheYouTubeVideo(song.sourceId);
                    break;
                case 'niconico':
                    this.initNiconicoPlayer(song.sourceId, playerContainer.id);
                    break;
                case 'local':
                    this.initAudioPlayer(song.sourceUrl, playerContainer);
                    // オーディオをキャッシュ
                    this.cacheAudioFile(song.sourceUrl, song.id);
                    break;
            }
        }
        
        // シークバーの初期化
        this.initSeekBar();
        
        // 時間更新用インターバルを設定
        this.setupTimeUpdateInterval();
        
        // 初期歌詞表示
        this.updateLyricsDisplay();
    },

    // シークバーの更新
    updateSeekBar: function() {
        const seekBar = document.getElementById('seek-bar');
        const currentTimeEl = document.getElementById('current-time');
        const durationTimeEl = document.getElementById('duration-time');
        
        if (!seekBar || !this.player) return;
        
        // ドラッグ中は更新しない
        if (this.isDragging) return;
        
        try {
            // 現在時間とデュレーションを取得
            const currentTime = this.getCurrentTime();
            const duration = this.getDuration();
            
            // NaNや無限大を防止
            if (isNaN(duration) || !isFinite(duration) || duration <= 0) {
                return;
            }
            
            // シークバーの値を更新（0-10000の精細なスケール）
            const value = Math.min(10000, Math.max(0, Math.round((currentTime / duration) * 10000)));
            seekBar.value = value;
            
            // プログレスバーの色を更新
            const percentage = (value / 10000) * 100;
            seekBar.style.setProperty('--seek-progress', `${percentage}%`);
            
            // 時間表示を更新
            currentTimeEl.textContent = formatTime(currentTime);
            durationTimeEl.textContent = formatTime(duration);
        } catch (error) {
            console.error('シークバー更新エラー:', error);
        }
    },

    // シークバーの初期化
    initSeekBar: function() {
        const seekBar = document.getElementById('seek-bar');
        const currentTimeEl = document.getElementById('current-time');
        const durationTimeEl = document.getElementById('duration-time');
        const timeBubble = document.getElementById('seek-time-bubble');
        
        if (!seekBar) return;
        
        // シークバーの最大値を設定
        seekBar.max = 10000;
        
        // イベントリスナーの設定
        this.setupSeekBarEvents(seekBar, currentTimeEl, timeBubble);
        
        // 初期値を設定
        this.updateSeekBar();
        
        // 間奏マーカーを設定
        this.updateInterludeMarkers();
    },

    // 間奏・前奏マーカーの更新
    updateInterludeMarkers: function() {
        if (!this.currentSong || !this.currentSong.lyrics) return;
        
        const markersContainer = document.getElementById('interlude-markers');
        if (!markersContainer) return;
        
        // マーカーをクリア
        markersContainer.innerHTML = '';
        
        const duration = this.getDuration();
        if (isNaN(duration) || duration <= 0) return;
        
        // 間奏・前奏の行だけをフィルタリング
        const specialLines = this.currentSong.lyrics.filter(line => 
            line.type !== 'normal' && line.time >= 0
        );
        
        // 時間順にソート
        const sortedLines = [...this.currentSong.lyrics].sort((a, b) => a.time - b.time);
        
        // 各特殊行に対して処理
        specialLines.forEach(line => {
            // 次の行を探す（時間順で次にくる行）
            let nextLineTime = null;
            for (let i = 0; i < sortedLines.length; i++) {
                if (sortedLines[i].time > line.time) {
                    nextLineTime = sortedLines[i].time;
                    break;
                }
            }
            
            // 行の開始位置
            const startTime = line.time;
            
            // 行の終了位置を計算
            let endTime;
            if (line.duration) {
                // 明示的に設定されている場合
                endTime = startTime + line.duration;
            } else if (nextLineTime !== null) {
                // 次の行がある場合、その時間まで
                endTime = nextLineTime;
            } else {
                // 次の行がない場合はデフォルト30秒
                endTime = startTime + 30;
            }
            
            // 開始・終了位置をパーセント値に変換
            const startPercent = Math.max(0, Math.min(100, (startTime / duration) * 100));
            const endPercent = Math.max(0, Math.min(100, (endTime / duration) * 100));
            const width = endPercent - startPercent;
            
            // 幅が0より大きい場合のみマーカーを作成
            if (width > 0) {
                const marker = document.createElement('div');
                marker.className = `interlude-marker ${line.type}`;
                marker.style.left = `${startPercent}%`;
                marker.style.width = `${width}%`;
                marker.title = `${line.type === 'prelude' ? '前奏' : '間奏'}: ${formatTime(startTime)} - ${formatTime(endTime)}`;
                markersContainer.appendChild(marker);
            }
        });
    },

    // 総再生時間を取得
    getDuration: function() {
        if (!this.player) return 0;
        
        switch (this.playerType) {
            case 'youtube':
                return typeof this.player.getDuration === 'function' ? 
                    this.player.getDuration() : 0;
            case 'audio':
                return this.audioElement ? this.audioElement.duration : 0;
            default:
                return 300; // デフォルト5分
        }
    },

    // シークバーのイベント設定
    setupSeekBarEvents: function(seekBar, currentTimeEl, timeBubble) {
        // シーク位置のリアルタイム表示を更新するための関数
        const updateSeekPosition = (e) => {
            // シークバーの位置を計算
            const seekBarRect = seekBar.getBoundingClientRect();
            const seekValue = parseInt(seekBar.value);
            const thumbPosition = (seekValue / 10000) * seekBarRect.width;
            
            // シーク中の現在時間を表示
            const duration = this.getDuration();
            const seekTime = (seekValue / 10000) * duration;
            
            // バブル表示を更新
            timeBubble.textContent = formatTime(seekTime);
            timeBubble.style.left = `${thumbPosition + 16}px`; // 16pxはコンテナのパディング
            timeBubble.classList.add('visible');
            
            // プログレスバーの色も更新
            const percentage = (seekValue / 10000) * 100;
            seekBar.style.setProperty('--seek-progress', `${percentage}%`);
        };
        
        // マウス用イベントリスナー
        seekBar.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            updateSeekPosition(e);
        });
        
        // タッチ用イベントリスナー
        seekBar.addEventListener('touchstart', (e) => {
            this.isDragging = true;
            updateSeekPosition(e);
        });
        
        // 入力値変更時
        seekBar.addEventListener('input', (e) => {
            updateSeekPosition(e);
            
            // 現在時間表示を更新
            const duration = this.getDuration();
            const seekValue = parseInt(e.target.value);
            const seekTime = (seekValue / 10000) * duration;
            currentTimeEl.textContent = formatTime(seekTime);
        });
        
        // ドラッグ終了時
        seekBar.addEventListener('change', (e) => {
            // シーク位置を反映
            const duration = this.getDuration();
            const seekValue = parseInt(e.target.value);
            const seekTime = (seekValue / 10000) * duration;
            this.seekTo(seekTime);
            
            // 少し遅延させてからドラッグフラグをオフに
            setTimeout(() => {
                this.isDragging = false;
                timeBubble.classList.remove('visible');
            }, 100);
        });
        
        // マウス移動時にもバブルを更新
        seekBar.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                updateSeekPosition(e);
            }
        });
        
        // タッチ移動時にもバブルを更新
        seekBar.addEventListener('touchmove', (e) => {
            if (this.isDragging) {
                updateSeekPosition(e);
            }
        });
        
        // マウスアップで確実にドラッグ終了
        window.addEventListener('mouseup', (e) => {
            if (this.isDragging) {
                setTimeout(() => {
                    this.isDragging = false;
                    timeBubble.classList.remove('visible');
                }, 100);
            }
        });
        
        // タッチエンドでも確実にドラッグ終了
        window.addEventListener('touchend', (e) => {
            if (this.isDragging) {
                setTimeout(() => {
                    this.isDragging = false;
                    timeBubble.classList.remove('visible');
                }, 100);
            }
        });
        
        // シークバーにホバーした時もバブルを表示
        seekBar.addEventListener('mouseover', (e) => {
            // シークバーの位置を計算
            const seekBarRect = seekBar.getBoundingClientRect();
            const mouseX = e.clientX - seekBarRect.left;
            const mousePercent = mouseX / seekBarRect.width;
            
            // マウス位置の時間を表示
            const duration = this.getDuration();
            const hoverTime = mousePercent * duration;
            
            // バブル表示を更新
            timeBubble.textContent = formatTime(hoverTime);
            timeBubble.style.left = `${mouseX + 16}px`; // 16pxはコンテナのパディング
            timeBubble.classList.add('visible');
        });
        
        seekBar.addEventListener('mousemove', (e) => {
            if (!this.isDragging) {
                const seekBarRect = seekBar.getBoundingClientRect();
                const mouseX = e.clientX - seekBarRect.left;
                const mousePercent = mouseX / seekBarRect.width;
                
                const duration = this.getDuration();
                const hoverTime = mousePercent * duration;
                
                timeBubble.textContent = formatTime(hoverTime);
                timeBubble.style.left = `${mouseX + 16}px`;
                timeBubble.classList.add('visible');
            }
        });
        
        seekBar.addEventListener('mouseout', (e) => {
            if (!this.isDragging) {
                timeBubble.classList.remove('visible');
            }
        });
    },

    // YouTube プレーヤーの初期化
    initYouTubePlayer: function(videoId, containerId) {
        this.playerType = 'youtube';
        
        // YouTube IFrame API をロード
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
            
            // API読み込み完了時のコールバック
            window.onYouTubeIframeAPIReady = () => {
                this.createYouTubePlayer(videoId, containerId);
            };
        } else {
            this.createYouTubePlayer(videoId, containerId);
        }
    },

    // YouTube プレーヤーの作成
    createYouTubePlayer: function(videoId, containerId) {
        this.player = new YT.Player(containerId, {
            height: '270',
            width: '480',
            videoId: videoId,
            playerVars: {
                'autoplay': 0,
                'controls': 1,
                'rel': 0
            },
            events: {
                'onReady': this.onPlayerReady.bind(this),
                'onStateChange': this.onYouTubeStateChange.bind(this)
            }
        });
    },

    // ニコニコ動画プレーヤーの初期化
    initNiconicoPlayer: function(videoId, containerId) {
        this.playerType = 'niconico';
        const container = document.getElementById(containerId);
        
        // iframeを作成
        const iframe = document.createElement('iframe');
        iframe.width = '480';
        iframe.height = '270';
        iframe.src = `https://embed.nicovideo.jp/watch/${videoId}?oldScript=1&referer=&from=0&allowProgrammaticFullScreen=1`;
        iframe.frameBorder = '0';
        iframe.allow = 'autoplay';
        iframe.allowFullscreen = true;
        
        container.appendChild(iframe);
        
        // ニコニコ動画はAPI制御できないので、疑似的なプレーヤーオブジェクトを作成
        this.player = {
            getPlayerState: () => 1, // 常に再生中と見なす
            getCurrentTime: () => {
                // タイムスタンプを計測開始時点からの経過時間で計算
                if (this.startTime) {
                    return (Date.now() - this.startTime) / 1000;
                }
                return 0;
            },
            playVideo: () => {
                this.startTime = Date.now();
                // 実際には制御できないので、メッセージを表示
                showToast('ニコニコ動画はプレーヤー内で直接操作してください', 'info');
            },
            pauseVideo: () => {
                // 実際には制御できないので、メッセージを表示
                showToast('ニコニコ動画はプレーヤー内で直接操作してください', 'info');
            },
            seekTo: (seconds) => {
                // 実際には制御できないので、メッセージを表示
                showToast('ニコニコ動画はプレーヤー内で直接操作してください', 'info');
            }
        };
        
        setTimeout(this.onPlayerReady.bind(this), 1000);
    },

    // オーディオプレーヤーの初期化（ローカルファイル用）
    initAudioPlayer: function(audioUrl, container) {
        this.playerType = 'audio';
        
        // audio要素を作成
        this.audioElement = document.createElement('audio');
        this.audioElement.controls = true;
        this.audioElement.style.width = '100%';
        this.audioElement.src = audioUrl;
        
        container.appendChild(this.audioElement);
        
        // イベントリスナーを設定
        this.audioElement.addEventListener('play', () => {
            UI.updatePlayPauseButton(this.isEditing ? false : true);
        });
        
        this.audioElement.addEventListener('pause', () => {
            UI.updatePlayPauseButton(this.isEditing ? false : true);
        });
        
        // 疑似的なプレーヤーオブジェクト
        this.player = {
            getPlayerState: () => this.audioElement.paused ? 2 : 1, // 1: 再生中, 2: 一時停止
            getCurrentTime: () => this.audioElement.currentTime,
            playVideo: () => this.audioElement.play(),
            pauseVideo: () => this.audioElement.pause(),
            seekTo: (seconds) => {
                this.audioElement.currentTime = seconds;
                return true;
            }
        };
        
        this.onPlayerReady();
    },

    // プレーヤー準備完了イベントハンドラ
    onPlayerReady: function(event) {
        // UIの初期状態を設定
        UI.updatePlayPauseButton(this.isEditing ? false : true);
        
        // シークバーの初期化と間奏マーカーの更新
        if (!this.isEditing) {
            // 少し遅延させてプレーヤーがデュレーションを取得できるようにする
            setTimeout(() => {
                this.updateSeekBar();
                this.updateInterludeMarkers();
            }, 500);
        }
        
        // 編集モードではなく再生モードの場合、自動再生
        if (!this.isEditing) {
            this.play();
        }
    },

    // YouTube状態変更イベントハンドラ
    onYouTubeStateChange: function(event) {
        // 状態に応じてUIを更新
        switch (event.data) {
            case YT.PlayerState.PLAYING:
                UI.updatePlayPauseButton(this.isEditing ? false : true);
                break;
            case YT.PlayerState.PAUSED:
                UI.updatePlayPauseButton(this.isEditing ? false : true);
                break;
        }
    },

    // 時間更新用インターバルの設定
    setupTimeUpdateInterval: function() {
        // 既存のインターバルをクリア
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
        }
        
        // 新しいインターバルを設定（50msごとに更新して精度向上）
        this.timeUpdateInterval = setInterval(() => {
            if (this.player && this.isPlaying()) {
                const currentTime = this.getCurrentTime();
                
                if (this.isEditing) {
                    // 編集モードの場合、タイミングUIを更新
                    UI.updateTimingUI(currentTime);
                } else {
                    // 再生モードの場合
                    // 1. シークバーを更新
                    this.updateSeekBar();
                    // 2. 現在の歌詞を更新
                    this.checkLyricsUpdate(currentTime);
                }
            }
        }, 50); // 100msから50msに短縮
    },

    // 現在の時間にマッチする歌詞を確認し、表示を更新
    checkLyricsUpdate: function(currentTime) {
        if (!this.currentSong || !this.currentSong.lyrics || this.currentSong.lyrics.length === 0) {
            return;
        }
        
        const lyrics = this.currentSong.lyrics;
        let newIndex = -1;
        
        // 時間でソートされた歌詞配列を作成
        const sortedLyrics = [...lyrics].sort((a, b) => a.time - b.time);
        
        // 現在の時間に対応する歌詞行を検索
        for (let i = sortedLyrics.length - 1; i >= 0; i--) {
            if (sortedLyrics[i].time <= currentTime) {
                // 元の配列でのインデックスを取得
                newIndex = lyrics.findIndex(line => line.id === sortedLyrics[i].id);
                break;
            }
        }
        
        // インデックスが変わった場合のみ更新
        if (newIndex !== this.currentLyricIndex) {
            this.currentLyricIndex = newIndex;
            this.updateLyricsDisplay();
            
            // 間奏・前奏の処理
            if (newIndex >= 0 && lyrics[newIndex].type !== 'normal') {
                const specialLine = lyrics[newIndex];
                
                // 間奏・前奏の長さを計算
                let duration;
                
                // 保存された明示的な長さがある場合はそれを使用
                if (specialLine.duration) {
                    duration = specialLine.duration;
                } else {
                    // なければその場で計算
                    duration = this.calculateSpecialLineDuration(lyrics, newIndex);
                    // 計算結果をキャッシュ（再計算を避けるため）
                    specialLine.calculatedDuration = duration;
                }
                
                const endTime = specialLine.time + duration;
                const remainingTime = endTime - currentTime;
                
                if (remainingTime > 0) {
                    UI.toggleInterludeOverlay(true, specialLine.type, remainingTime);
                    
                    // 終了時にオーバーレイを非表示
                    setTimeout(() => {
                        UI.toggleInterludeOverlay(false);
                    }, remainingTime * 1000);
                }
            } else {
                UI.toggleInterludeOverlay(false);
            }
        } else if (newIndex >= 0 && lyrics[newIndex].type !== 'normal') {
            // 間奏・前奏の残り時間を更新
            const specialLine = lyrics[newIndex];
            
            // 間奏・前奏の長さを取得
            let duration;
            if (specialLine.duration) {
                duration = specialLine.duration;
            } else if (specialLine.calculatedDuration) {
                duration = specialLine.calculatedDuration;
            } else {
                duration = this.calculateSpecialLineDuration(lyrics, newIndex);
                specialLine.calculatedDuration = duration;
            }
            
            const endTime = specialLine.time + duration;
            const remainingTime = endTime - currentTime;
            
            if (remainingTime > 0) {
                document.getElementById('interlude-time').textContent = formatTime(remainingTime);
            } else {
                UI.toggleInterludeOverlay(false);
            }
        }
    },

    // 間奏・前奏の長さを計算
    calculateSpecialLineDuration: function(lyrics, index) {
        if (!lyrics || index < 0 || index >= lyrics.length || lyrics[index].type === 'normal') {
            return 30; // デフォルト値
        }
        
        // 現在の行の時間
        const currentTime = lyrics[index].time;
        
        // 現在の行以降で、時間が設定されている（time > 0）最も近い行を探す
        let nextLine = null;
        let nextTime = Infinity;
        
        for (let i = 0; i < lyrics.length; i++) {
            // 自分自身はスキップ
            if (i === index) continue;
            
            // 時間が設定されていない行はスキップ
            if (lyrics[i].time <= 0) continue;
            
            // 現在の行より後の行を探す
            if (lyrics[i].time > currentTime && lyrics[i].time < nextTime) {
                nextTime = lyrics[i].time;
                nextLine = lyrics[i];
            }
        }
        
        // 次の行が見つかった場合
        if (nextLine) {
            // 間奏の長さは次の行の開始時間から現在の行の開始時間を引いた値
            const duration = nextTime - currentTime;
            // 最低でも3秒は確保
            return Math.max(duration, 3);
        }
        
        // 次の行が見つからない場合（最後の行の場合など）
        return 30; // デフォルト値を返す
    },

    // 歌詞表示を更新
    updateLyricsDisplay: function() {
        if (!this.currentSong || !this.currentSong.lyrics || this.currentLyricIndex < 0) {
            // 歌詞がないか、まだ始まっていない場合
            UI.updateLyricsDisplay(null, null, null);
            return;
        }
        
        const lyrics = this.currentSong.lyrics;
        const currentLineIndex = this.currentLyricIndex;
        
        // 前後の歌詞行を取得
        const prevLine = currentLineIndex > 0 ? lyrics[currentLineIndex - 1] : null;
        const currentLine = lyrics[currentLineIndex];
        const nextLine = currentLineIndex < lyrics.length - 1 ? lyrics[currentLineIndex + 1] : null;
        
        // UIを更新
        UI.updateLyricsDisplay(prevLine, currentLine, nextLine);
    },

    // 再生/一時停止の切り替え
    togglePlayPause: function() {
        if (!this.player) return;
        
        if (this.isPlaying()) {
            this.pause();
        } else {
            this.play();
        }
    },

    // 再生開始
    play: function() {
        if (!this.player) return;
        
        this.player.playVideo();
    },

    // 一時停止
    pause: function() {
        if (!this.player) return;
        
        this.player.pauseVideo();
    },

    // 停止（完全に終了）
    stop: function() {
        this.cleanUp();
    },

    // 特定の時間にシーク
    seekTo: function(seconds) {
        if (!this.player) return;
        
        this.player.seekTo(seconds, true);
    },

    // 特定の歌詞行にシーク
    seekToLyricLine: function(index) {
        if (!this.currentSong || !this.currentSong.lyrics || index < 0 || index >= this.currentSong.lyrics.length) {
            return;
        }
        
        const line = this.currentSong.lyrics[index];
        this.seekTo(line.time);
        this.currentLyricIndex = index;
        this.updateLyricsDisplay();
    },

    // 前の歌詞行に移動
    previousLine: function() {
        if (this.currentLyricIndex > 0) {
            this.seekToLyricLine(this.currentLyricIndex - 1);
        }
    },

    // 次の歌詞行に移動
    nextLine: function() {
        if (this.currentLyricIndex < this.currentSong.lyrics.length - 1) {
            this.seekToLyricLine(this.currentLyricIndex + 1);
        }
    },

    // 現在時間を取得
    getCurrentTime: function() {
        if (!this.player) return 0;
        
        return this.player.getCurrentTime();
    },

    // 再生中かどうかを確認
    isPlaying: function() {
        if (!this.player) return false;
        
        // YouTube: 1 = 再生中
        // Audio: paused = false で再生中
        if (this.playerType === 'youtube') {
            return this.player.getPlayerState() === 1;
        } else {
            return this.player.getPlayerState() === 1;
        }
    },

    // メディアキャッシュの確認
    checkMediaCache: function(song) {
        // キャッシュが無効化されている場合はスキップ
        if (!this.isCachingEnabled()) return null;
        
        // IndexedDB等からキャッシュを取得
        if (song.sourceType === 'local') {
            return this.getAudioCache(song.id);
        } else if (song.sourceType === 'youtube') {
            return this.getYouTubeCache(song.sourceId);
        }
        
        return null;
    },

    // キャッシュが有効かどうか
    isCachingEnabled: function() {
        // ユーザー設定でキャッシュが無効化されているかを確認
        const cachingDisabled = loadFromLocalStorage('syncapp_disable_cache');
        if (cachingDisabled) return false;
        
        // ストレージサポートのチェック
        try {
            if (!window.indexedDB && !window.caches) return false;
            return true;
        } catch (e) {
            return false;
        }
    },

    // キャッシュされたメディアの初期化
    initCachedMedia: function(cachedMedia, container) {
        this.playerType = 'cached';
        
        // 今回はCached Audio実装のみ対応
        if (cachedMedia.type === 'audio') {
            this.initCachedAudio(cachedMedia.blob, container);
        } else {
            // キャッシュ形式が不明または未対応の場合、標準再生にフォールバック
            showToast('キャッシュされたメディアの再生に失敗しました。オンライン再生を行います。', 'warning');
            
            if (this.currentSong.sourceType === 'youtube') {
                this.initYouTubePlayer(this.currentSong.sourceId, container.id);
            } else if (this.currentSong.sourceType === 'niconico') {
                this.initNiconicoPlayer(this.currentSong.sourceId, container.id);
            } else if (this.currentSong.sourceType === 'local') {
                this.initAudioPlayer(this.currentSong.sourceUrl, container);
            }
        }
    },

    // キャッシュされたオーディオの初期化
    initCachedAudio: function(blob, container) {
        this.playerType = 'audio';
        
        // オーディオ要素を作成
        this.audioElement = document.createElement('audio');
        this.audioElement.controls = true;
        this.audioElement.style.width = '100%';
        
        // Blobを使用してURLを生成
        const url = URL.createObjectURL(blob);
        this.audioElement.src = url;
        
        container.appendChild(this.audioElement);
        
        // イベントリスナーを設定
        this.audioElement.addEventListener('play', () => {
            UI.updatePlayPauseButton(this.isEditing ? false : true);
        });
        
        this.audioElement.addEventListener('pause', () => {
            UI.updatePlayPauseButton(this.isEditing ? false : true);
        });
        
        // 疑似的なプレーヤーオブジェクト
        this.player = {
            getPlayerState: () => this.audioElement.paused ? 2 : 1, // 1: 再生中, 2: 一時停止
            getCurrentTime: () => this.audioElement.currentTime,
            playVideo: () => this.audioElement.play(),
            pauseVideo: () => this.audioElement.pause(),
            seekTo: (seconds) => {
                this.audioElement.currentTime = seconds;
                return true;
            }
        };
        
        // ページをアンロードするときにURLを解放
        window.addEventListener('beforeunload', () => {
            URL.revokeObjectURL(url);
        });
        
        this.onPlayerReady();
    },

    // オーディオファイルのキャッシュ
    cacheAudioFile: function(url, songId) {
        if (!this.isCachingEnabled()) return;
        
        // すでにキャッシュされているか確認
        this.getAudioCache(songId).then(cached => {
            if (cached) return; // すでにキャッシュされている場合はスキップ
            
            // ファイルをダウンロードしてキャッシュ
            fetch(url)
                .then(response => response.blob())
                .then(blob => {
                    this.saveAudioCache(songId, blob);
                })
                .catch(error => {
                    console.error('Audio caching error:', error);
                });
        });
    },

    // オーディオキャッシュの保存
    saveAudioCache: function(songId, blob) {
        try {
            // IndexedDBにキャッシュを保存
            const request = window.indexedDB.open('SyncAppMediaCache', 1);
            
            request.onupgradeneeded = function(event) {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('audioCache')) {
                    db.createObjectStore('audioCache', { keyPath: 'id' });
                }
            };
            
            request.onsuccess = function(event) {
                const db = event.target.result;
                const transaction = db.transaction(['audioCache'], 'readwrite');
                const store = transaction.objectStore('audioCache');
                
                store.put({
                    id: songId,
                    blob: blob,
                    timestamp: Date.now()
                });
                
                transaction.oncomplete = function() {
                    db.close();
                };
            };
        } catch (e) {
            console.error('IndexedDB error:', e);
        }
    },

    // オーディオキャッシュの取得
    getAudioCache: function(songId) {
        return new Promise((resolve, reject) => {
            try {
                const request = window.indexedDB.open('SyncAppMediaCache', 1);
                
                request.onupgradeneeded = function(event) {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('audioCache')) {
                        db.createObjectStore('audioCache', { keyPath: 'id' });
                    }
                };
                
                request.onsuccess = function(event) {
                    const db = event.target.result;
                    const transaction = db.transaction(['audioCache'], 'readonly');
                    const store = transaction.objectStore('audioCache');
                    const getRequest = store.get(songId);
                    
                    getRequest.onsuccess = function() {
                        const result = getRequest.result;
                        if (result) {
                            resolve({
                                type: 'audio',
                                blob: result.blob
                            });
                        } else {
                            resolve(null);
                        }
                    };
                    
                    getRequest.onerror = function() {
                        resolve(null);
                    };
                    
                    transaction.oncomplete = function() {
                        db.close();
                    };
                };
                
                request.onerror = function() {
                    resolve(null);
                };
            } catch (e) {
                console.error('IndexedDB error:', e);
                resolve(null);
            }
        });
    },

    // YouTube動画のキャッシュ
    // 注意: 技術的な制限により、実際のYouTube動画コンテンツはキャッシュできません
    // この関数は参考実装であり、実際にはキャッシュポリシーによりブロックされます
    cacheYouTubeVideo: function(videoId) {
        // YouTubeはサードパーティのコンテンツであり、
        // ブラウザのセキュリティポリシーによりキャッシュ実装が制限されます
        // この実装は技術的なデモとしてのみ含まれています
        console.log('YouTube動画のキャッシュは技術的な制限により実装されていません');
    },

    // YouTube動画キャッシュの取得
    getYouTubeCache: function(videoId) {
        // 上記の理由により、常にnullを返します
        return Promise.resolve(null);
    },

    // リソースのクリーンアップ
    cleanUp: function() {
        // インターバルをクリア
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }
        
        // プレーヤーの破棄
        if (this.player) {
            if (this.playerType === 'youtube' && typeof this.player.destroy === 'function') {
                this.player.destroy();
            }
            this.player = null;
        }
        
        // Audioエレメントのクリーンアップ
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
            this.audioElement.remove();
            this.audioElement = null;
        }
        
        // 状態をリセット
        this.playerType = null;
        this.currentSong = null;
        this.isEditing = false;
    }
};

// グローバルスコープにエクスポート
window.Player = Player;