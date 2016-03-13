/**
 * Created by dongwookyoon on 6/25/15.
 */

/** @namespace r2 */
(function(r2){
    "use strict";

    r2.audioStitcher = (function(){
        var pub = {};

        /*
        snippets: a list of audio snippets
                [<snippet>, <snippet>, <snippet>, ...]
        snippet: a dictionary of source audio and time range (in sec)
                {
                    url: 'https://...blob.wav',
                    t_bgn: 1.23,
                    t_end: 1.56
                }
         */
        pub.run = function(snippets, cb){
            var src_wavs = {};
            var final_wav = {};
            var src_streams = {};
            var master_stream = null;

            var wav_urls = [];

            snippets.forEach(function(snippet){
                if(wav_urls.indexOf(snippet.url) === -1)
                    wav_urls.push(snippet.url);
            });

            console.log("Running r2.audioStitcher for snippets: ", snippets);

            loadWavFromUrls(wav_urls, src_wavs).then(
                function(wavs){
                    final_wav = getWavFormat(wavs);
                    return final_wav;
                }
            ).then(
                function(final_wav){
                    final_wav.stream = getStreamFromSnippets(snippets, final_wav, src_wavs);
                    return final_wav;
                }
            ).then(
                function(final_wav){
                    var blob = encodeBlob(final_wav);
                    var url = (window.URL || window.webkitURL).createObjectURL(blob);
                    if (cb) cb(url);
                }
            );

            // fill src_streams
            var src_wav_keys = Object.keys(src_wavs);
            src_wav_keys.forEach(function(url){
                src_streams[url] = (src_wavs[url]);
            });

            // stitch and create a master stream

        };

        var loadWavFromUrls = function(urls, wavs){
            return new Promise(function(resolve, reject){
                // fill src wavs
                var job = function(i){
                    if(i !== urls.length){
                        loadWavFromUrl(urls[i]).then(
                            function(wav){
                                wavs[urls[i]] = wav;
                                job(i+1);
                            }
                        ).catch(
                            reject
                        );
                    }
                    else{
                        resolve(wavs);
                    }
                };
                job(0);
            });
        };

        var loadWavFromUrl = function(url){
            return getUrlData(url, 'arraybuffer').then(function(array_buffer){
                var view = new DataView(array_buffer);
                var stream_buffer = array_buffer.slice(44);
                var wav = {
                    format_chunk: view.getUint32(16, true),
                    sample_format: view.getUint16(20, true),
                    channel_count: view.getUint16(22, true),
                    sample_rate: view.getUint32(24, true),
                    byte_rate: view.getUint32(28, true),
                    block_align: view.getUint16(32, true),
                    bits_per_sample: view.getUint16(34, true),
                    stream: stream_buffer,
                    byte_array: new Uint8Array(stream_buffer)
                };

                return wav;
            });
        };

        /*
        get a template format of the final audio wav file from the sources
        formats of all the source audios should be the same, and if not, throw an error
         */
        var getWavFormat = function(wavs){
            var wav = {};
            for(var key in wavs){
                for(var format_key in wavs[key]){
                    if(format_key !== 'stream' && format_key !== 'byte_array'){ // stream is not a format parameter
                        if(!wav.hasOwnProperty(format_key)){
                            wav[format_key] = wavs[key][format_key];
                        }
                        else{
                            if(wav[format_key] !== wavs[key][format_key]){
                                throw Error('inconsistent format error (all the audio source need to have the same format):', format_key);
                            }
                        }
                    }
                }
            }
            return wav;
        };

        var getStreamFromSnippets = function(snippets, final_wav, src_wavs){
            var total_length = 0;
            for(var i = 0, l = snippets.length; i < l; ++i){
                var snippet = snippets[i];
                var byte_array = src_wavs[snippet.url].byte_array;
                snippet.i_bgn = Math.min(byte_array.length-1, Math.max(0, Math.round(final_wav.byte_rate * snippet.t_bgn)));
                snippet.i_bgn = snippet.i_bgn-snippet.i_bgn%(final_wav.bits_per_sample/8);
                snippet.i_end = Math.min(byte_array.length-1, Math.max(0, Math.round(final_wav.byte_rate * snippet.t_end)));
                snippet.i_end = snippet.i_end-snippet.i_end%(final_wav.bits_per_sample/8);
                total_length += snippet.i_end-snippet.i_bgn;
            }

            var dst_buffer = new ArrayBuffer(total_length);
            var dst_view = new DataView(dst_buffer);

            var dst_offset = 0;
            //console.log('>>>>', 'total_length:', byte_array.byteLength);
            for(var i = 0, l = snippets.length; i < l; ++i){
                var snippet = snippets[i];
                var byte_array = src_wavs[snippet.url].byte_array;
                var i_bgn = snippet.i_bgn;
                var i_end = snippet.i_end;
                //console.log('>>>>', i, ': ', i_bgn, i_end, dst_offset);
                copyArrayBuffer(
                    byte_array,
                    i_bgn,
                    i_end-i_bgn,
                    dst_view,
                    dst_offset
                );
                dst_offset += i_end-i_bgn;
            }

            return dst_buffer;
        };

        var copyArrayBuffer = function(src_uint8array, src_offset, src_length, dst_view, dst_offset){
            for(var i = 0, l = src_length; i < l; ++i){
                dst_view.setUint8(dst_offset+i, src_uint8array[src_offset+i]);
            }
        };

        var encodeBlob = function(wav){
            var view = new DataView(new ArrayBuffer(44 + wav.stream.byteLength));

            /* RIFF identifier */
            writeString(view, 0, 'RIFF');
            /* RIFF chunk length */
            view.setUint32(4, 36 + wav.stream.byteLength, true);
            /* RIFF type */
            writeString(view, 8, 'WAVE');
            /* format chunk identifier */
            writeString(view, 12, 'fmt ');
            /* format chunk length */
            view.setUint32(16, wav.format_chunk, true);
            /* sample format (raw) */
            view.setUint16(20, wav.sample_format, true);
            /* channel count */
            view.setUint16(22, wav.channel_count, true);
            /* sample rate */
            view.setUint32(24, wav.sample_rate, true);
            /* byte rate (sample rate * block align) */
            view.setUint32(28, wav.byte_rate, true);
            /* block align (channel count * bytes per sample) */
            view.setUint16(32, wav.block_align, true);
            /* bits per sample */
            view.setUint16(34, wav.bits_per_sample, true);
            /* data chunk identifier */
            writeString(view, 36, 'data');
            /* data chunk length */
            view.setUint32(40, wav.stream.byteLength, true);
            /* data */
            var stream_array = new Uint8Array(wav.stream);
            for(var i = 0, l = stream_array.length; i < l; ++i){
                view.setUint8(44+i, stream_array[i]);
            }

            /* return blob */
            return new Blob([view], { type: "audio/l16" });
        };

        function writeString(view, offset, string){
            for (var i = 0; i < string.length; i++){
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }

        var getUrlData = function(path, resp_type, progress_cb){
            return new Promise(function(resolve, reject){
                var xhr = new XMLHttpRequest();
                if ("withCredentials" in xhr) { // "withCredentials" only exists on XMLHTTPRequest2 objects.
                    xhr.open('GET', path, true);
                    xhr.withCredentials = true;
                    xhr.responseType = resp_type;
                }
                else if (typeof XDomainRequest != "undefined") { // Otherwise, XDomainRequest only exists in IE, and is IE's way of making CORS requests.
                    xhr = new XDomainRequest();
                    xhr.open(method, path);
                }
                else {
                    reject(new Error('Error from GetUrlData: CORS is not supported by the browser.'));
                }

                if (!xhr) {
                    reject(new Error('Error from GetUrlData: CORS is not supported by the browser.'));
                }
                xhr.onerror = reject;

                xhr.addEventListener('progress', function(event) {
                    if(event.lengthComputable) {
                        var progress = (event.loaded / event.total) * 100;
                        if(progress_cb)
                            progress_cb(progress);
                    }
                });

                xhr.onreadystatechange = function(){
                    if (xhr.readyState === 4){   //if complete
                        if(xhr.status === 200){  //check if "OK" (200)
                            resolve(xhr.response);
                        } else {
                            reject(new Error("XMLHttpRequest Error, Status code:" + xhr.status));
                        }
                    }
                };

                xhr.send();
            });
        };

        return pub;
    }());

}(window.r2 = window.r2 || {}));
