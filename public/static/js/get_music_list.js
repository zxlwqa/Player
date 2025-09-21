
var funDownload = function(content, filename) {
    var eleLink = document.createElement('a');
    eleLink.download = filename;
    eleLink.style.display = 'none';
    // 字符内容转变成blob地址
    var blob = new Blob([content]);
    eleLink.href = URL.createObjectURL(blob);
    // 触发点击
    document.body.appendChild(eleLink);
    eleLink.click();
    // 然后移除
    document.body.removeChild(eleLink);
};

$("#save").click(function(){
    // 获取当前播放器中的音乐列表
    let musicList = [];
    
    // 使用播放器实例的当前模式
    const url = PlayerObj.musics.isApiMode ? PlayerObj.musics.apiUrl : '/api/music/list';
    
    $.ajax({
        url: url,
        method: 'GET',
        async: false,
        success: function(response) {
            musicList = response.data.map(item => ({
                filename: item.filename,
                url: item.url
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
        // 重新初始化播放器
        PlayerObj = new Player();
        $("#upfile").val("");
    }
});
