const NodeMediaServer = require('node-media-server');

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    allow_origin: '*',
    mediaroot: './media'
  },
  trans: {
    ffmpeg: '/usr/bin/ffmpeg',  // на Render ffmpeg предустановлен
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        dash: true,
        dashFlags: '[f=dash:window_size=3:extra_window_size=5]'
      }
    ]
  }
};

const nms = new NodeMediaServer(config);
nms.run();

console.log('🚀 RTMP сервер запущен!');
console.log('📡 RTMP порт: 1935');
console.log('🌐 HLS порт: 8000');
console.log('');
console.log('📱 Настройка в PRISM:');
console.log('   URL: rtmp://ВАШ_САЙТ.onrender.com/live');
console.log('   Stream Key: moto');
console.log('');
console.log('👁️ Ссылка для зрителей:');
console.log('   http://ВАШ_САЙТ.onrender.com/live/moto/index.m3u8');
