/**
 * Created by yoon on 1/13/16.
 */


(function(test){
    "use strict";

    var recording = null;
    var word_list = [];

    bluemix_stt.getAuthInfo().then(
        function(authToken) {
            // create context
            test.context = {
                token: authToken,
                model: 'en-US_BroadbandModel', // audio sampled at >= 16 KHz
                requestLogging: 'false' // opt-in for data logging that enhances model
            };

            // set context in the localStorage
            window.onbeforeunload = function(e) {
                localStorage.clear();
            };

            // set event trigger
            bluemix_stt.messageParser.setCallbacks(
                function(words){
                    result_disp.append_temp(words);
                },
                function(words, conf){
                    result_disp.append_final(words);
                }
            );
            result_disp.init();

            return;
        }
    ).catch(
        function(err){
            if(err instanceof Error){
                alert(err.message);
            }
            else{
                alert(JSON.stringify(err));
            }

        }
    );

    r2.audioRecorder.Init({'lib_ext/recorder/recorderWorker.js': '../../lib_ext/recorder/recorderWorker.js'}).catch(
        function(err){
            alert(err.message);
        }
    );

    test.recordBgn = function(){
        bluemix_stt.handleMicrophone(
            test.context,
            r2.audioRecorder,
            function(err, socket) { // opened
                if (err) {
                    console.error(err);
                } else {
                    r2.audioRecorder.BgnRecording();
                }
            },
            function(msg){ // transcript
                bluemix_stt.messageParser.run(msg);
            },
            function() { // closed
                console.log('Done');
            }
        );

    };

    test.recordStop = function(){
        $.publish('hardsocketstop');
        r2.audioRecorder.EndRecording().then(
            function(result){
                recording = result;
            }
        );
    };

    test.play = function(){
        r2.audioPlayer.play(recording.id, recording.url, word_list[1][1]*1000.);
    };

    test.synthesize = function(){
        var talkens = [];
        var i;
        for(i in word_list){
            if(i%2 === 0){
                var word = word_list[i];
                talkens.push(
                    {
                        audio_url: recording.url,
                        bgn: word[1],
                        end: word[2]
                    }
                );
            }
        }
        r2.audioSynthesizer.run(talkens).then(
            function(result){
                r2.audioPlayer.play(1, result.url, 0);
            }
        );
    };

    var result_disp = (function(){
        var pub = {};
        var $p = null;
        var last_temp_n = 0;

        pub.init = function(){
            $p = $('#stt_result');
        };

        pub.append_temp = function(words){
            var i;
            for(i = 0; i < last_temp_n; ++i){
                $p.find(':last-child').remove();
                console.log('remove');
            }
            for(i in words){
                var w = words[i];
                var $span = $(document.createElement('div'));
                $span.text(w[0]);
                $p.append($span);
            }
            last_temp_n = words.length;
        };

        pub.append_final = function(words){
            var i;
            for(i = 0; i < last_temp_n; ++i){
                $p.find(':last-child').remove();
                console.log('remove');
            }
            for(i in words){
                var w = words[i];
                var $span = $(document.createElement('div'));
                $span.text(w[0]);
                $p.append($span);
                word_list.push(w);
            }
            last_temp_n = 0;
        };

        return pub;
    }());

}(window.test = window.test || {}));

