
var funDownload = function(content, filename) {
    var eleLink = document.createElement('a');
    eleLink.download = filename;
    eleLink.style.display = 'none';
    var blob = new Blob([content]);
    eleLink.href = URL.createObjectURL(blob);
    document.body.appendChild(eleLink);
    eleLink.click();
    document.body.removeChild(eleLink);
};

$("#save").click(function(){
    let musicList = [];
    
    const url = PlayerObj.musics.isApiMode ? PlayerObj.musics.apiUrl : '/api/music/list';
    
    $.ajax({
        url: url,
        method: 'GET',
        async: false,
        success: function(response) {
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
                        url: url
                    };
                });
            }
            
            musicList = items.map(item => ({
                filename: item.filename || 'unknown.mp3',
                url: item.url || ''
            }));
        },
        error: function(xhr, status, error) {
            console.error('获取音乐列表失败:', error);
        }
    });
    
    funDownload(JSON.stringify(musicList), 'music_list.json');
});

$("#upfile").click();
$("#upfile").on("change", function () {
    var obj = document.getElementById("upfile");
    var selectedFile = obj.files[0];
    var reader = new FileReader();
    reader.readAsText(selectedFile);

    reader.onload = function(){
        let json = JSON.parse(this.result);
        PlayerObj = new Player();
        $("#upfile").val("");
    }
});
