/**
 * Created by Dongwook on 2/9/2016.
 */

/** @namespace r2 */
(function(r2){

    r2.recordingCtrl = (function(){
        var pub = {};

        var triggered = false;
        var anchor_piece = null;
        var ui_type = null; // WAVEFORM, SIMPLE_SPEECH, OR NEW_SPEAK

        pub.set = function(_anchor_piece, _ui_type){
            triggered = true;
            anchor_piece = _anchor_piece;
            ui_type = _ui_type;
        };

        pub.isReady = function(){
            return triggered;
        };

        pub.bgn = function(){
            triggered = false;
            if(ui_type === r2App.RecordingUI.WAVEFORM){
                r2.recordingBgn.waveform(anchor_piece);
            }
            else{
                var done = function(){
                    if(ui_type === r2App.RecordingUI.SIMPLE_SPEECH){
                        r2.recordingBgn.simpleSpeech(anchor_piece);
                    }
                    else if(ui_type === r2App.RecordingUI.NEW_SPEAK){
                        r2.recordingBgn.newSpeak(anchor_piece);
                    }
                };
                if(r2App.bluemix_tts_auth_context){
                    console.log('auth_set', r2App.bluemix_tts_auth_context);
                    done();
                }
                else{ // if auth context not set
                    bluemix_stt.getAuthInfo().then(
                        function(authToken) {
                            console.log('auth', authToken);
                            r2App.bluemix_tts_auth_context = {
                                token: authToken,
                                model: 'en-US_BroadbandModel', // audio sampled at >= 16 KHz
                                requestLogging: 'false' // opt-in for data logging that enhances model
                            };
                            return done();
                        }
                    ).catch(function(e){
                        alert('Please login to https://richreview.net for Bluemix Authentication');
                    });
                }
            }
        };

        pub.stop = function(){
            if(ui_type === r2App.RecordingUI.WAVEFORM){
                r2.recordingStop.waveform(anchor_piece);
            }
            else if(ui_type === r2App.RecordingUI.SIMPLE_SPEECH){
                r2.recordingStop.simpleSpeech(anchor_piece);
            }
            else if(ui_type === r2App.RecordingUI.NEW_SPEAK){
                r2.recordingStop.newSpeak(anchor_piece);
            }
        };

        pub.update = function(){
            if(ui_type === r2App.RecordingUI.WAVEFORM){
                r2.recordingUpdate();
            }
        };

        return pub;
    }());

    r2.recordingBgn = (function(){
        var pub = {};
        pub.waveform = function(anchor_piece){
            run(anchor_piece, createPieceAudio);
        };
        pub.simpleSpeech = function(anchor_piece){
            run(anchor_piece, createPieceSimpleSpeech);
        };
        pub.newSpeak = function(anchor_piece){
            run(anchor_piece, createPieceNewSpeak);
        };

        var run = function(anchor_piece, funcCreatePiece){

            /* create Annot */
            r2App.cur_recording_annot = new r2.Annot();
            var annotid = new Date(r2App.cur_time).toISOString();
            r2App.cur_recording_annot.SetAnnot(
                annotid, anchor_piece.GetId(), r2App.cur_time, r2App.cur_time, [], r2.userGroup.cur_user.name, ""
            );
            r2App.annots[annotid] = r2App.cur_recording_annot;

            /* set context */
            r2App.cur_recording_anchor_piece = anchor_piece;
            r2App.cur_recording_pieceaudios = [];

            /* create piece */
            funcCreatePiece(anchor_piece, annotid);

            /* begin audio recording */
            r2.audioRecorder.BgnRecording();

            /* update system variables */
            r2.dom.enableRecordingIndicators();
            r2App.mode = r2App.AppModeEnum.RECORDING;
            r2App.invalidate_size = true;
            r2App.invalidate_page_layout = true;

        };

        var createPieceAudio = function(anchor_piece, annotid){
            /* create piece object */
            var pieceaudio = new r2.PieceAudio();
            pieceaudio.SetPiece(
                r2.pieceHashId.voice(annotid, 0), // this piece is the first waveform line
                r2App.cur_recording_annot.GetBgnTime(),
                anchor_piece.GetNewPieceSize(),
                anchor_piece.GetTTData()
            );
            pieceaudio.SetPieceAudio(annotid, r2.userGroup.cur_user.name, 0, 0);
            r2App.cur_recording_pieceaudios.push(pieceaudio);
            anchor_piece.AddChildrenAtFront(r2App.cur_recording_pieceaudios);

            /* update dom with the object */
            r2.dom_model.createCommentVoice(r2App.cur_recording_annot, r2App.cur_pdf_pagen, true); /* live_recording = true */
            r2.dom_model.appendPieceVoice(annotid, 0, r2App.cur_recording_annot.GetBgnTime(), pieceaudio);
        };

        var createPieceSimpleSpeech = function(anchor_piece, annotid){
            var piece_simple_speech = new r2.PieceSimpleSpeech();
            piece_simple_speech.SetPiece(
                r2.pieceHashId.voice(annotid, 0), // this piece is the first waveform line
                r2App.cur_recording_annot.GetBgnTime(),
                anchor_piece.GetNewPieceSize(),
                anchor_piece.GetTTData()
            );
            piece_simple_speech.SetPieceSimpleSpeech(
                anchor_piece.GetId(), annotid, r2.userGroup.cur_user.name,
                '', // inner_html
                true // live_recording
            );
            anchor_piece.AddChildAtFront(piece_simple_speech);
            piece_simple_speech.setForTesting();

            // set event trigger
            bluemix_stt.messageParser.setCallbacks(
                function(words){
                    piece_simple_speech.setCaptionTemporary(words);
                },
                function(words, conf){
                    piece_simple_speech.setCaptionFinal(words);
                }
            );
            // begin recording
            bluemix_stt.handleMicrophone(
                r2App.bluemix_tts_auth_context,
                r2.audioRecorder,
                function(err, socket) { // opened
                    if (err) {

                    } else {

                    }
                },
                function(msg){ // transcript
                    bluemix_stt.messageParser.run(msg);
                },
                function() { // closed
                    piece_simple_speech.doneCaptioning();
                }
            );
        };

        var createPieceNewSpeak = function(anchor_piece, annotid){
            var piece_new_speak = new r2.PieceNewSpeak();
            piece_new_speak.SetPiece(
                r2.pieceHashId.voice(annotid, 0), // this piece is the first waveform line
                r2App.cur_recording_annot.GetBgnTime(),
                anchor_piece.GetNewPieceSize(),
                anchor_piece.GetTTData()
            );
            piece_new_speak.SetPieceNewSpeak(
                anchor_piece.GetId(), annotid, r2.userGroup.cur_user.name,
                '', // inner_html
                true // live_recording
            );
            anchor_piece.AddChildAtFront(piece_new_speak);

            // set event trigger
            bluemix_stt.messageParser.setCallbacks(
                function(words){
                    piece_new_speak.setCaptionTemporary(words);
                },
                function(words, conf){
                    piece_new_speak.setCaptionFinal(words);
                }
            );
            // begin recording
            bluemix_stt.handleMicrophone(
                r2App.bluemix_tts_auth_context,
                r2.audioRecorder,
                function(err, socket) { // opened
                    if (err) {

                    } else {

                    }
                },
                function(msg){ // transcript
                    bluemix_stt.messageParser.run(msg);
                },
                function() { // closed
                    piece_new_speak.doneCaptioning();
                }
            );
        };

        return pub;
    }());


    r2.recordingStop = (function(){
        var pub = {};
        pub.waveform = function(to_upload){
            run(to_upload, onPieceAudio);
        };
        pub.simpleSpeech = function(to_upload){
            run(to_upload, onPieceSimpleSpeech);
        };
        pub.newSpeak = function(to_upload){
            run(to_upload, onPieceNewSpeak);
        };

        var run = function(to_upload, funcOn){
            /* end audio recording */
            r2.audioRecorder.EndRecording(
                function(url, blob){

                    // Pass audio URL to PieceSimpleSpeech if necessary...
                    if(this.onEndRecording)
                        this.onEndRecording(url);

                    // R2 audio url
                    this.SetRecordingAudioFileUrl(url, blob);

                    if(to_upload)
                        r2Sync.PushToUploadCmd(this.ExportToCmd());
                }.bind(r2App.cur_recording_annot)
            );
            r2.PieceAudio.prototype.NormalizePieceAudio(r2App.cur_recording_pieceaudios, refresh_all = true);

            /* update dom */
            r2.dom_model.cbRecordingStop(r2App.cur_recording_annot.GetId());

            /* release context */
            r2App.cur_recording_annot = null;
            r2App.cur_recording_pieceaudios = null;

            /* update system variables */
            r2.dom.disableRecordingIndicators();
            r2App.mode = r2App.AppModeEnum.IDLE;
            r2App.invalidate_size = true;
            r2App.invalidate_page_layout = true;

            funcOn();
        };

        var onPieceAudio = function(){
        };

        var onPieceSimpleSpeech = function(){
            $.publish('hardsocketstop');
        };

        var onPieceNewSpeak = function(){
            $.publish('hardsocketstop');
        };

        return pub;
    }());

    r2.recordingUpdate = function(){
        r2.audioRecorder.getDbs(function(dbs){
            r2App.cur_recording_annot.UpdateDbs(dbs);
            r2.util.lastOf(r2App.cur_recording_pieceaudios).UpdateAudioDbsRecording(r2App.cur_time-r2App.cur_recording_annot.GetBgnTime());

            var timePerPiece = r2Const.PIECEAUDIO_TIME_PER_WIDTH*r2.util.lastOf(r2App.cur_recording_pieceaudios).GetTtIndentedWidth();
            var npiece = Math.ceil(r2App.cur_recording_annot.GetDuration()/timePerPiece);
            if(r2App.cur_recording_pieceaudios.length < npiece){
                var anchorpiece = r2App.cur_recording_anchor_piece;

                var pieceaudio = new r2.PieceAudio();
                var annot = r2App.cur_recording_annot;
                pieceaudio.SetPiece(
                    r2.pieceHashId.voice(r2App.cur_recording_annot.GetId(), npiece-1),
                    r2App.cur_recording_annot.GetBgnTime(),
                    anchorpiece.GetNewPieceSize(),
                    anchorpiece.GetTTData()
                );
                pieceaudio.SetPieceAudio(
                    annot.GetId(),
                    r2.userGroup.cur_user.name,
                    (npiece-1)*timePerPiece,
                    r2App.cur_time-annot.GetBgnTime());


                r2App.cur_recording_pieceaudios.push(pieceaudio);
                anchorpiece.AddChildrenAtFront(r2App.cur_recording_pieceaudios);

                r2App.invalidate_size = true;
                r2App.invalidate_page_layout = true;

                /* dom */
                r2.dom_model.appendPieceVoice(annot.GetId(), npiece-1, r2App.cur_recording_annot.GetBgnTime(), pieceaudio);
            }
            r2.PieceAudio.prototype.NormalizePieceAudio(r2App.cur_recording_pieceaudios, refresh_all = false);
        });
    };
}(window.r2 = window.r2 || {}));
