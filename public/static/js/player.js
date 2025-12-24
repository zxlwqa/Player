class Player {
    constructor() { 
        if (Player.instance) return Player.instance;
        return this.getInstance(...arguments);
    }

    getInstance() {
        let instance = new PlayerCreator(...arguments);
        Player.instance = instance;
        return instance;
    }
}

class Musics {
    constructor() {
        this.songs = [];
        this.favorites = [];
        this.isApiMode = localStorage.getItem('musicPlayer_isApiMode') === 'true' || false;
        this.apiUrl = localStorage.getItem('musicPlayer_apiUrl') || '';
        this.isFavoritesMode = localStorage.getItem('musicPlayer_isFavoritesMode') === 'true' || false;
        if (this.isFavoritesMode) {
            this.loadFavorites();
        } else {
        this.loadMusicList();
            this.loadFavoritesFromGist();
        }
    }
    
    loadFavoritesFromGist() {
        $.ajax({
            url: '/api/gist/favorites',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ action: 'load' }),
            success: (response) => {
                if (response.ok && Array.isArray(response.favorites)) {
                    this.favorites = response.favorites;
                    if (Player.instance && !this.isFavoritesMode) {
                        Player.instance.renderSongList();
                    }
                }
            },
            error: (error) => {
                console.error('加载收藏列表失败:', error);
            }
        });
    }

    loadMusicList() {
        const url = this.isApiMode ? this.apiUrl : '/api/music/list';
        
        $.ajax({
            url: url,
            method: 'GET',
            async: false,
            success: (response) => {
                const bgp = [
                    "a.webp",
                    "b.webp",
                    "c.webp",
                    "d.webp",
                    "e.webp",
                    "f.webp",
                    "g.webp",
                    "h.webp",
                    "i.webp",
                    "j.webp",
                    "k.webp",
                    "l.webp",
                    "m.webp",
                    "n.webp",
                    "o.webp",
                    "p.webp",
                    "q.webp",
                    "r.webp",
                    "s.webp",
                    "t.webp",
                    "u.webp",
                    "v.webp",
                    "w.webp",
                    "x.webp",
                    "y.webp",
                    "z.webp"
                ];
                
                let items = [];
                
                if (response && response.data && Array.isArray(response.data)) {
                    items = response.data;
                }
                else if (response && response.tracks && Array.isArray(response.tracks)) {
                    items = response.tracks.map(track => {
                        let filename = '';
                        let title = track.title || '';
                        let url = track.url || '';
                        
                        if (title) {
                            let ext = '.mp3';
                            try {
                                const urlObj = new URL(url);
                                const pathname = urlObj.pathname;
                                const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
                                if (match) {
                                    ext = '.' + match[1].toLowerCase();
                                }
                            } catch (e) {
                            }
                            filename = title + ext;
                        } else if (url) {
                            try {
                                const urlObj = new URL(url);
                                filename = urlObj.pathname.split('/').pop() || 'unknown.mp3';
                            } catch (e) {
                                filename = 'unknown.mp3';
                            }
                        } else {
                            filename = 'unknown.mp3';
                        }
                        
                        return {
                            filename: filename,
                            url: url,
                            title: title
                        };
                    });
                }
                
                if (items && items.length > 0) {
                    items.forEach(item => {
                        const fileName = item.filename || 'unknown.mp3';
                        const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
                        let title, singer;
                        
                        if (item.title) {
                            if (item.title.includes('-')) {
                                const parts = item.title.split('-');
                                title = parts[0].trim();
                                singer = parts.slice(1).join('-').trim();
                            } else {
                                title = item.title;
                                singer = "未知";
                            }
                        } else {
                        if (nameWithoutExt.includes('-')) {
                            const parts = nameWithoutExt.split('-');
                            title = parts[0].trim();
                                singer = parts.slice(1).join('-').trim();
                        } else {
                            title = nameWithoutExt;
                            singer = "未知";
                            }
                        }

                        this.songs.push({
                            fileName: fileName,
                            title: title,
                            singer: singer || "未知",
                            songUrl: item.url,
                            imageUrl: '/static/music_data/images/' + bgp[Math.floor(Math.random() * bgp.length)]
                        });
                    });
                }
            },
            error: (xhr, status, error) => {
                console.error('获取音乐列表失败:', error);
                const mode = this.isApiMode ? 'API' : '本地';
                alert(`获取${mode}音乐列表失败，请检查网络连接或API地址`);
            }
        });
    }

    switchToApiMode(baseUrl) {
        this.isApiMode = true;
        this.isFavoritesMode = false;
        this.apiUrl = baseUrl.endsWith('/') ? baseUrl + 'api/music/list' : baseUrl + '/api/music/list';
        localStorage.setItem('musicPlayer_isApiMode', 'true');
        localStorage.setItem('musicPlayer_isFavoritesMode', 'false');
        localStorage.setItem('musicPlayer_apiUrl', this.apiUrl);
        this.songs = [];
        this.loadMusicList();
    }

    switchToLocalMode() {
        this.isApiMode = false;
        this.isFavoritesMode = false;
        this.apiUrl = '';
        localStorage.setItem('musicPlayer_isApiMode', 'false');
        localStorage.setItem('musicPlayer_isFavoritesMode', 'false');
        localStorage.removeItem('musicPlayer_apiUrl');
        this.songs = [];
        this.loadMusicList();
    }

    getCurrentMode() {
        if (this.isFavoritesMode) {
            return '收藏歌单';
        }
        if (this.isApiMode) {
            if (this.apiUrl && this.apiUrl.includes('/api/github/list')) {
                return 'GitHub歌单';
            }
            if (this.apiUrl && this.apiUrl.includes('/api/r2/list')) {
                return 'R2歌单';
            }
            if (this.apiUrl && this.apiUrl.includes('/api/webdav/list')) {
                return '云盘歌单';
            }
            return 'API歌单';
        }
        return '内置歌单';
    }
    
    loadFavorites() {
        $.ajax({
            url: '/api/gist/favorites',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ action: 'load' }),
            success: (response) => {
                if (response.ok && Array.isArray(response.favorites)) {
                    this.favorites = response.favorites;
                    this.songs = this.favorites.map(fav => {
                        if (typeof fav === 'string') {
                            const parts = fav.split(' - ');
                            return {
                                title: parts[0] || '未知',
                                singer: parts.length > 1 ? parts.slice(1).join(' - ') : '未知',
                                songUrl: fav,
                                imageUrl: '/static/music_data/images/a.webp'
                            };
                        } else if (typeof fav === 'object' && fav.url) {
                            return {
                                title: fav.title || fav.filename || '未知',
                                singer: fav.singer || '未知',
                                songUrl: fav.url,
                                imageUrl: fav.imageUrl || '/static/music_data/images/a.webp'
                            };
                        }
                        return null;
                    }).filter(song => song !== null);
                } else {
                    this.songs = [];
                }
            },
            error: (error) => {
                console.error('加载收藏歌单失败:', error);
                this.songs = [];
                alert('加载收藏歌单失败: ' + (error.responseJSON?.error || error.statusText));
            }
        });
    }
    
    saveFavorites(callback) {
        const favorites = this.favorites.map(fav => {
            if (typeof fav === 'string') {
                return fav;
            } else if (typeof fav === 'object') {
                return {
                    url: fav.url || fav.songUrl,
                    title: fav.title || fav.filename,
                    singer: fav.singer,
                    imageUrl: fav.imageUrl
                };
            }
            return null;
        }).filter(fav => fav !== null);
        
        $.ajax({
            url: '/api/gist/favorites',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ action: 'save', favorites: favorites }),
            success: (response) => {
                if (response.ok) {
                    if (callback) callback(true);
                } else {
                    if (callback) callback(false, response.error || '保存失败');
                }
            },
            error: (error) => {
                console.error('保存收藏歌单失败:', error);
                if (callback) callback(false, error.responseJSON?.error || error.statusText);
            }
        });
    }
    
    isFavorite(songUrl) {
        return this.favorites.some(fav => {
            if (typeof fav === 'string') {
                return fav === songUrl;
            } else if (typeof fav === 'object' && fav.url) {
                return fav.url === songUrl;
            }
            return false;
        });
    }
    
    toggleFavorite(song) {
        const songUrl = song.songUrl || song.url;
        const favoriteIndex = this.favorites.findIndex(fav => {
            if (typeof fav === 'string') {
                return fav === songUrl;
            } else if (typeof fav === 'object' && fav.url) {
                return fav.url === songUrl;
            }
            return false;
        });
        
        if (favoriteIndex >= 0) {
            this.favorites.splice(favoriteIndex, 1);
        } else {
            this.favorites.push({
                url: songUrl,
                title: song.title || song.filename,
                singer: song.singer || '未知',
                imageUrl: song.imageUrl || '/static/music_data/images/a.webp'
            });
        }
        
        this.saveFavorites((success, error) => {
            if (!success) {
                alert('保存收藏失败: ' + error);
            }
        });
    }
    
    switchToFavoritesMode() {
        this.isFavoritesMode = true;
        this.isApiMode = false;
        this.apiUrl = '';
        localStorage.setItem('musicPlayer_isFavoritesMode', 'true');
        localStorage.setItem('musicPlayer_isApiMode', 'false');
        localStorage.removeItem('musicPlayer_apiUrl');
        this.loadFavorites();
    }
    getSongByNum(index) {
        return this.songs[index];
    }
}

class PlayerCreator {
    constructor() {
        this.audio = document.querySelector('.music-player__audio')
        this.audio.volume = 1.0;

        this.util = new Util();
        this.musics = new Musics();

        this.song_index = 0;
        this.loop_mode = 0;
        this.song_list = $('.music__list_content');
        this.song_find = $('.find_song');
        this.search_button = $('.bar7 button')

        this.render_doms = {
            title: $('.music__info--title'),
            singer: $('.music__info--singer'),
            image: $('.music-player__image img'),
            blur: $('.music-player__blur')
        }
        this.ban_dom = {
            control__btn: $('.control__volume--icon')
        }

        this.render_time = {
            now: $('.nowTime'),
            total: $('.totalTime')
        }

        this.disc = {
            image: $('.music-player__image'),
            pointer: $('.music-player__pointer')
        };
        this.init();
    }
    init() {
        this.renderSongList();
        this.renderSongStyle();
        this.bindEventListener();
    }
    renderSongList() {
        this.song_list = $('.music__list_content');
        let _str = '';
        this.musics.songs.forEach((song, i) => {
            const isPlaying = i === this.song_index ? ' class="music__list__item play"' : ' class="music__list__item"';
            const isFavorite = this.musics.isFavorite(song.songUrl || song.url);
            const favoriteIcon = isFavorite ? '❤️' : '♡';
            _str += `<li${isPlaying} data-index="${i}">${song.title} - ${song.singer} <span class="favorite-btn" data-index="${i}" style="float:right;padding-right:8px;cursor:pointer;font-size:16px;color:#4388e0">${favoriteIcon}</span><a href="${song.songUrl}" style="float:right;padding-right:12px">下载</a></li>`;
        });
        this.song_list.html(_str);

        this.song_list.off('click').on('click', 'li', (e) => {
            if ($(e.target).is('a') || $(e.target).is('.favorite-btn')) return;
            const index = parseInt($(e.target).closest('li').data('index'));
            if (!isNaN(index)) {
                this.changeSong(index);
                this.audio.play();
                this.$play.$el.find('i').removeClass('icon-play').addClass('icon-pause');
                this.disc.image.addClass('play');
                this.disc.pointer.addClass('play');
            }
        });
        
        this.song_list.off('click', '.favorite-btn').on('click', '.favorite-btn', (e) => {
            e.stopPropagation();
            const index = parseInt($(e.target).closest('li').data('index'));
            if (!isNaN(index)) {
                const song = this.musics.getSongByNum(index);
                if (song) {
                    this.musics.toggleFavorite(song);
                    this.renderSongList();
                }
            }
        });
    }

    renderSongStyle() {
        if (this.musics.songs.length === 0) {
            this.audio.src = '';
            this.render_doms.title.html('暂无歌曲');
            this.render_doms.singer.html('请添加音乐文件');
            document.title = '音乐播放器';
            
            this.preloadAndSetImage('/static/music_data/images/a.webp');
            return;
        }

        let {
            title,
            singer,
            songUrl,
            imageUrl
        } = this.musics.getSongByNum(this.song_index);
        this.audio.src = songUrl;
        this.render_doms.title.html(title);
        this.render_doms.singer.html(singer);
        document.title = title+" - "+singer;
        
        this.preloadAndSetImage(imageUrl);

        this.song_list.find('.music__list__item').eq(this.song_index).addClass('play').siblings().removeClass('play');
    }

    preloadAndSetImage(imageUrl) {
        const img = new Image();
        img.onload = () => {
            this.render_doms.image.prop('src', imageUrl);
            this.render_doms.blur.css('background-image', 'url("' + imageUrl + '")');
        };
        img.onerror = () => {
            console.warn('图片加载失败，使用默认图片:', imageUrl);
            this.render_doms.image.prop('src', imageUrl);
            this.render_doms.blur.css('background-image', 'url("' + imageUrl + '")');
        };
        img.src = imageUrl;
    }

    bindEventListener() {
        this.song_find.on('keyup', (e) => {
            const searchText = $.trim(this.song_find.val().toString());
            
            if (e.keyCode === 13) {
                this.searchAndPlaySong(searchText);
                return;
            }

            this.filterSongList(searchText);
        });

        this.song_find.on('blur', () => {
            setTimeout(() => {
                this.renderSongList();
                this.song_find.val('');
            }, 200);
        });

        this.search_button.on('click', () => {
            const searchText = $.trim(this.song_find.val().toString());
            this.searchAndPlaySong(searchText);
        });

        $(document).click(function () {
            $(".search_list").slideUp();
            $(".download").fadeOut();
        });
        $(".search_list").click(function (event) {
            event.stopPropagation();
        });

        this.$play = new Btns('.player-control__btn--play', {
            click: this.handlePlayAndPause.bind(this)
        });
        this.$prev = new Btns('.player-control__btn--prev', {
            click: this.changeSong.bind(this, 'prev')
        });
        this.$next = new Btns('.player-control__btn--next', {
            click: this.changeSong.bind(this, 'next')
        });
        this.$mode = new Btns('.player-control__btn--mode', {
            click: this.changePlayMode.bind(this)
        });
        this.$ban = new Btns('.control__volume--icon', {
            click: this.banNotes.bind(this)
        });

        this.$management = new Btns('.management-btn', {
            click: this.showManagementModal.bind(this)
        });

        this.$closeModal = new Btns('.close-btn', {
            click: this.hideManagementModal.bind(this)
        });

        this.$addSong = new Btns('#add-song', {
            click: this.handleAddSong.bind(this)
        });

        this.$deleteSong = new Btns('#delete-song', {
            click: this.handleDeleteSong.bind(this)
        });

        this.$switchApi = new Btns('#switch-api', {
            click: this.handleSwitchToApi.bind(this)
        });

        this.$switchLocal = new Btns('#switch-local', {
            click: this.handleSwitchToLocal.bind(this)
        });

        this.$switchR2 = new Btns('#switch-r2', {
            click: this.handleSwitchToR2.bind(this)
        });

        this.$switchGitHub = new Btns('#switch-github', {
            click: this.handleSwitchToGitHub.bind(this)
        });

        this.$switchWebDAV = new Btns('#switch-webdav', {
            click: this.handleSwitchToWebDAV.bind(this)
        });

        this.$switchFavorites = new Btns('#switch-favorites', {
            click: this.handleSwitchToFavorites.bind(this)
        });

        $('.modal-overlay').click(this.hideManagementModal.bind(this));

        this.volume = new Progress('.control__volume--progress', {
            min: 0,
            max: 1,
            value: this.audio.volume,
            handler: (value) => {
                this.audio.volume = value;
            }
        });

        this.volume.setValue(this.audio.volume);

        this.audio.oncanplay = () => {
            this.render_time.total.html(this.util.formatTime(this.audio.duration));
            
            if (!this.progress) {
                this.progress = new Progress('.player__song--progress', {
                    min: 0,
                    max: this.audio.duration,
                    value: 0,
                    handler: (value) => {
                        this.audio.currentTime = value;
                    }
                });
            } else {
                this.progress.max = this.audio.duration;
                this.progress.setValue(this.audio.currentTime);
            }
        }

        this.audio.ontimeupdate = () => {
            if (this.progress && !isNaN(this.audio.currentTime)) {
                this.progress.setValue(this.audio.currentTime);
                this.render_time.now.html(this.util.formatTime(this.audio.currentTime));
            }
        }

        this.audio.onended = () => {
            this.changeSong('next');
            this.audio.play();
        }

    }

    showManagementModal() {
        $('#song-url').val('');
        $('#song-name').val('');
        $('#admin-password').val('');
        $('#delete-song-name').val('');
        
        let baseUrl = '';
        if (this.musics.apiUrl) {
            baseUrl = this.musics.apiUrl.replace('/api/music/list', '');
        }
        $('#api-url').val(baseUrl);
        
        this.updateModeDisplay();
        
        $('.modal-overlay').fadeIn();
        $('.management-modal').fadeIn();
    }

    hideManagementModal() {
        $('#song-url').val('');
        $('#song-name').val('');
        $('#admin-password').val('');
        $('#delete-song-name').val('');
        
        $('.modal-overlay').fadeOut();
        $('.management-modal').fadeOut();
    }

    handleAddSong() {
        const url = $('#song-url').val().trim();
        const name = $('#song-name').val().trim();
        
        if (!url) {
            alert('请输入音乐URL');
            return;
        }
    
        const wasPlaying = !this.audio.paused;
        const currentTime = this.audio.currentTime;
        const currentSongIndex = this.song_index;
    
        $.get('/api/download', { url, name })
            .done(response => {
                alert(response.success ? '歌曲已添加到下载队列' : response.error || '添加失败');
                if (response.success) {
                    this.musics = new Musics();
                    setTimeout(() => {
                        this.song_index = currentSongIndex;
                        this.renderSongList();
                        this.renderSongStyle();
                        
                        if (wasPlaying) {
                            this.audio.currentTime = currentTime;
                            this.audio.play();
                            this.$play.$el.find('i').removeClass('icon-play').addClass('icon-pause');
                            this.disc.image.addClass('play');
                            this.disc.pointer.addClass('play');
                        }
                        
                        this.hideManagementModal();
                    }, 1000);
                }
            })
            .fail(error => {
                alert('添加失败: ' + (error.responseJSON?.error || error.statusText));
            });
    }

    handleDeleteSong() {
        const password = $('#admin-password').val().trim();
        const name = $('#delete-song-name').val().trim();
        
        if (!password) {
            alert('请输入管理密码');
            return;
        }

        const confirmMsg = name ? `确定要删除歌曲 "${name}" 吗?` : '确定要删除所有歌曲吗?';
        if (!confirm(confirmMsg)) return;

        $.post('/api/delete/music', { 
            names: name || undefined,
            password: password,
            all: name ? undefined : 'true'
        })
        .done(response => {
            alert(response.success ? `已删除 ${response.deletedFiles.length} 首歌曲` : response.error || '删除失败');
            if (response.success) {
                this.musics = new Musics();
                setTimeout(() => {
                    this.renderSongList();
                    this.renderSongStyle();
                    if (this.song_index >= this.musics.songs.length) {
                        this.song_index = 0;
                    }
                }, 1000);
                this.hideManagementModal();
            }
        })
        .fail(error => {
            alert('删除失败: ' + (error.responseJSON?.error || error.statusText));
        });
    }

    handleSwitchToApi() {
        const baseUrl = $('#api-url').val().trim();
        
        if (!baseUrl) {
            alert('请输入API服务器地址');
            return;
        }

        try {
            new URL(baseUrl);
        } catch (e) {
            alert('请输入有效的URL地址');
            return;
        }

        const wasPlaying = !this.audio.paused;
        const currentTime = this.audio.currentTime;

        this.musics.switchToApiMode(baseUrl);
        
        this.updateModeDisplay();
        this.renderSongList();
        this.renderSongStyle();
        
        if (wasPlaying && this.musics.songs.length > 0) {
            this.audio.currentTime = currentTime;
            this.audio.play();
            this.$play.$el.find('i').removeClass('icon-play').addClass('icon-pause');
            this.disc.image.addClass('play');
            this.disc.pointer.addClass('play');
        }

        alert('已切换到API歌单模式');
    }

    handleSwitchToLocal() {
        const wasPlaying = !this.audio.paused;
        const currentTime = this.audio.currentTime;

        this.musics.switchToLocalMode();
        
        this.updateModeDisplay();
        this.renderSongList();
        this.renderSongStyle();
        
        if (wasPlaying && this.musics.songs.length > 0) {
            this.audio.currentTime = currentTime;
            this.audio.play();
            this.$play.$el.find('i').removeClass('icon-play').addClass('icon-pause');
            this.disc.image.addClass('play');
            this.disc.pointer.addClass('play');
        }

        alert('已切换到内置歌单模式');
    }

    updateModeDisplay() {
        const mode = this.musics.getCurrentMode();
        $('#current-mode-status').text(`当前模式: ${mode}`);
    }

    handleSwitchToR2() {
        const wasPlaying = !this.audio.paused;
        const currentTime = this.audio.currentTime;

        this.musics.switchToApiMode(window.location.origin);
        this.musics.apiUrl = window.location.origin + '/api/r2/list';
        localStorage.setItem('musicPlayer_apiUrl', this.musics.apiUrl);
        this.musics.songs = [];
        this.musics.loadMusicList();
        
        this.updateModeDisplay();
        this.renderSongList();
        this.renderSongStyle();
        
        if (wasPlaying && this.musics.songs.length > 0) {
            this.audio.currentTime = currentTime;
            this.audio.play();
            this.$play.$el.find('i').removeClass('icon-play').addClass('icon-pause');
            this.disc.image.addClass('play');
            this.disc.pointer.addClass('play');
        }

        alert('已切换到R2歌单模式');
    }

    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    handleSwitchToGitHub() {
        const wasPlaying = !this.audio.paused;
        const currentTime = this.audio.currentTime;

        this.musics.switchToApiMode(window.location.origin);
        this.musics.apiUrl = window.location.origin + '/api/github/list';
        localStorage.setItem('musicPlayer_apiUrl', this.musics.apiUrl);
        this.musics.songs = [];
        this.musics.loadMusicList();
        
        this.updateModeDisplay();
        this.renderSongList();
        this.renderSongStyle();
        
        if (wasPlaying && this.musics.songs.length > 0) {
            this.audio.currentTime = currentTime;
            this.audio.play();
            this.$play.$el.find('i').removeClass('icon-play').addClass('icon-pause');
            this.disc.image.addClass('play');
            this.disc.pointer.addClass('play');
        }

        alert('已切换到GitHub歌单模式');
    }

    handleSwitchToWebDAV() {
        const wasPlaying = !this.audio.paused;
        const currentTime = this.audio.currentTime;

        this.musics.switchToApiMode(window.location.origin);
        this.musics.apiUrl = window.location.origin + '/api/webdav/list';
        localStorage.setItem('musicPlayer_apiUrl', this.musics.apiUrl);
        this.musics.songs = [];
        this.musics.loadMusicList();
        
        this.updateModeDisplay();
        this.renderSongList();
        this.renderSongStyle();
        
        if (wasPlaying && this.musics.songs.length > 0) {
            this.audio.currentTime = currentTime;
            this.audio.play();
            this.$play.$el.find('i').removeClass('icon-play').addClass('icon-pause');
            this.disc.image.addClass('play');
            this.disc.pointer.addClass('play');
        }

        alert('已切换到云盘歌单模式');
    }

    handleSwitchToFavorites() {
        const wasPlaying = !this.audio.paused;
        const currentTime = this.audio.currentTime;

        this.musics.switchToFavoritesMode();
        
        this.updateModeDisplay();
        this.renderSongList();
        this.renderSongStyle();
        
        if (wasPlaying && this.musics.songs.length > 0) {
            this.audio.currentTime = currentTime;
            this.audio.play();
            this.$play.$el.find('i').removeClass('icon-play').addClass('icon-pause');
            this.disc.image.addClass('play');
            this.disc.pointer.addClass('play');
        }

        alert('已切换到收藏歌单模式');
    }

    handlePlayAndPause() {
        let _o_i = this.$play.$el.find('i');
        if (this.audio.paused) {
            this.audio.play();
            _o_i.removeClass('icon-play').addClass('icon-pause');
            this.disc.image.addClass('play');
            this.disc.pointer.addClass('play')
        } else {
            this.audio.pause();
            _o_i.addClass('icon-play').removeClass('icon-pause');
            this.disc.image.removeClass('play');
            this.disc.pointer.removeClass('play');
        }
    }

    changePlayMode() {
        this.loop_mode++;
        if (this.loop_mode > 2) this.loop_mode = 0;
        this.renderPlayMode();
    }
    renderPlayMode() {
        let _classess = ['loop', 'random', 'single'];
        let _o_i = this.$mode.$el.find('i');
        _o_i.prop('class', 'iconfont icon-' + _classess[this.loop_mode])
    }

    changeSongIndex(type) {
        if (this.musics.songs.length === 0) {
            this.song_index = 0;
            return;
        }

        if (typeof type === 'number') {
            this.song_index = type;
        } else {
            if (this.loop_mode === 0) {
                this.song_index += type === 'next' ? 1 : -1;
                if (this.song_index > this.musics.songs.length - 1) this.song_index = 0;
                if (this.song_index < 0) this.song_index = this.musics.songs.length - 1;
            } else if (this.loop_mode === 1) {
                let _length = this.musics.songs.length;
                let _random = Math.floor(Math.random() * _length);
                for (let i = 0; i < 10000; i++) {
                    if (this.song_index == _random) {
                        _random = Math.floor(Math.random() * _length);
                    } else {
                        this.song_index = _random;
                        break;
                    }
                }
            } else if (this.loop_mode === 2) {
                this.song_index = this.song_index;
            }
        }
    }
    songTime() {
        let totalMinute = parseInt(this.audio.duration / 60) < 10 ? "0" + parseInt(this.audio.duration / 60) : parseInt(this.audio.duration / 60);
        let totalSecond = parseInt(this.audio.duration % 60) < 10 ? "0" + parseInt(this.audio.duration % 60) : parseInt(this.audio.duration % 60);
        $('.totalTime').text(totalMinute + ':' + totalSecond);
    }
    changeSong(type) {
        if (this.musics.songs.length === 0) {
            this.renderSongStyle();
            return;
        }

        this.changeSongIndex(type);
        let _is_pause = this.audio.paused;
        this.renderSongStyle();
        
        if (this.progress) {
            this.progress.$back.width(0);
            this.progress.$pointer.css('left', 0);
        }

        this.audio.onloadedmetadata = () => {
            this.render_time.total.html(this.util.formatTime(this.audio.duration));
            
            if (!this.progress) {
                this.progress = new Progress('.player__song--progress', {
                    min: 0,
                    max: this.audio.duration,
                    value: 0,
                    handler: (value) => {
                        this.audio.currentTime = value;
                    }
                });
            } else {
                this.progress.max = this.audio.duration;
                this.progress.setValue(0);
            }
        }

        if (!_is_pause) this.audio.play();
    }
    banNotes() {
        let _o_i = this.$ban.$el.find("i");
        if (this.audio.muted == true) {
            this.audio.muted = false;
            _o_i.removeClass('icon-muted').addClass('icon-volume');
        } else {
            this.audio.muted = true;
            _o_i.removeClass('icon-volume').addClass('icon-muted');
        }
    }

    searchAndPlaySong(searchText) {
        if (!searchText) return;
        
        const foundIndex = this.musics.songs.findIndex(song => 
            (song.title + ' - ' + song.singer).toLowerCase().includes(searchText.toLowerCase())
        );
        
        if (foundIndex !== -1) {
            this.changeSong(foundIndex);
            this.audio.play();
            this.$play.$el.find('i').removeClass('icon-play').addClass('icon-pause');
            this.disc.image.addClass('play');
            this.disc.pointer.addClass('play');

            setTimeout(() => {
                this.renderSongList();
                this.song_find.val('');
            }, 3000);
        }
    }

    filterSongList(searchText) {
        if (!searchText) {
            this.renderSongList();
            return;
        }

        let _str = '';
        this.musics.songs.forEach((song, i) => {
            if ((song.title + ' - ' + song.singer).toLowerCase().includes(searchText.toLowerCase())) {
                _str += `<li class="music__list__item" data-index="${i}">${song.title} - ${song.singer} <a href="${song.songUrl}" style="float:right;padding-right:12px">下载</a></li>`;
            }
        });
        this.song_list.html(_str);

        this.song_list.off('click').on('click', 'li', (e) => {
            if ($(e.target).is('a')) return;
            const index = parseInt($(e.target).closest('li').data('index'));
            if (!isNaN(index)) {
                this.changeSong(index);
                this.audio.play();
                this.$play.$el.find('i').removeClass('icon-play').addClass('icon-pause');
                this.disc.image.addClass('play');
                this.disc.pointer.addClass('play');
            }
        });
    }
}

class Progress {
    constructor(selector, options) {
        $.extend(this, options);
        this.$el = $(selector);
        this.width = this.$el.width();
        this.init();
    }

    init() {
        this.renderBackAndPointer();
        this.bindEvents();
        this.drag();
        this.value = this.value || 0;
    }

    renderBackAndPointer() {
        this.$back = $('<div class="back">');
        this.$pointer = $('<div class="pointer">');
        this.$el.append(this.$back);
        this.$el.append(this.$pointer);
    }

    setValue(value) {
        if (!this.max || isNaN(value)) return;
        this.value = Math.min(Math.max(value, this.min), this.max);
        let _distance = this.width * (this.value - this.min) / (this.max - this.min);
        this.changeDOMStyle(_distance);
    }

    changeDOMStyle(distance) {
        if (isNaN(distance)) return;
        distance = Math.max(0, Math.min(distance, this.width));
        this.$back.width(distance);
        this.$pointer.css('left', Math.max(0, distance - 7) + 'px');
    }

    bindEvents() {
        this.$el.click((e) => {
            let _x = e.offsetX;
            let _ratio = _x / this.width;
            let _value = _ratio * (this.max - this.min) + this.min;
            this.setValue(_value);
            this.handler(_value);
        });
    }

    drag() {
        let ele = this.$pointer;
        let father = this.$el;
        let flag = false;
        
        ele.mousedown((e) => {
            flag = true;
            let mousePos = { x: e.offsetX };
            
            $(document).mousemove((e) => {
                if (flag === true) {
                    let _left = e.clientX - father.offset().left - mousePos.x;
                    let _distance = Math.max(0, Math.min(_left, this.width));
                    let _ratio = _distance / this.width;
                    let _value = _ratio * (this.max - this.min) + this.min;
                    this.setValue(_value);
                    this.handler(_value);
                }
            });
        });
        
        $(document).mouseup(() => {
            flag = false;
        });
    }
}

class Btns {
    constructor(selector, handlers) {
        this.$el = $(selector);
        this.bindEvents(handlers);
    }
    bindEvents(handlers) {
        for (const event in handlers) {
            if (handlers.hasOwnProperty(event)) {
                this.$el.on(event, handlers[event]);
            }
        }
    }
}
PlayerObj = new Player();
