/**
 * Created by Dongwook on 2/9/2016.
 */

/** @namespace r2 */
(function(r2){

    r2.recordingCtrl = (function(){
        var pub = {};

        var triggered = false;
        var anchor_piece = null;
        var options = {}; // has ui_type, WAVEFORM, SIMPLE_SPEECH, NEW_SPEAK, OR WAVE_WEAVER

        pub.set = function(_anchor_piece, _options){
            if(r2App.is_recording_or_transcribing){
                alert('Recording and transcribing is currently in progress.');
                return;
            }
            if(r2App.disable_comment_production){
                alert('This page is only for the review. Features for creating comments are disabled.');
                return;
            }
            triggered = true;
            anchor_piece = _anchor_piece;
            options = _options;
        };

        pub.isReady = function(){
            return triggered;
        };

        pub.bgn = function(){
            triggered = false;
            if(options.ui_type === r2App.RecordingUI.WAVEFORM){
                r2.recordingBgn.waveform(anchor_piece, options);
            }
            else{
                var done = function(){
                    if( options.ui_type === r2App.RecordingUI.NEW_SPEAK ||
                        options.ui_type === r2App.RecordingUI.SIMPLE_SPEECH ||
                        options.ui_type === r2App.RecordingUI.WAVE_WEAVER
                    ){
                        r2.recordingBgn.transcription(anchor_piece, options);
                    }
                };
                if(r2App.bluemix_tts_auth_context){
                    done();
                }
                else{ // if auth context not set
                    bluemix_stt.getAuthInfo().catch(
                        function(e){
                            alert('Please login to https://richreview.net for Bluemix Authentication');
                        }
                    ).then(
                        function(authToken) {
                            if(authToken){ // auth successful
                                r2App.bluemix_tts_auth_context = {
                                    token: authToken,
                                    model: 'en-US_BroadbandModel', // audio sampled at >= 16 KHz
                                    requestLogging: 'false' // opt-in for data logging that enhances model
                                };
                                return done();
                            }
                            else{ // auth failed
                                return null;
                            }
                        }
                    );
                }
            }
        };

        pub.stop = function(){
            if(options.ui_type === r2App.RecordingUI.WAVEFORM){
                r2.recordingStop.waveform(anchor_piece);
            }
            else if(
                options.ui_type === r2App.RecordingUI.NEW_SPEAK ||
                options.ui_type === r2App.RecordingUI.SIMPLE_SPEECH ||
                options.ui_type === r2App.RecordingUI.WAVE_WEAVER

            ){
                r2.recordingStop.transcription(anchor_piece);
            }
        };

        pub.update = function(){
            if(options.ui_type === r2App.RecordingUI.WAVEFORM){
                r2.recordingUpdate();
            }
        };

        return pub;
    }());

    r2.recordingBgn = (function(){
        var pub = {};
        pub.waveform = function(anchor_piece, options){
            run(anchor_piece, createPieceAudio, options);
        };
        pub.transcription = function(anchor_piece, options){
            run(anchor_piece, createPieceTranscription, options);
        };

        var run = function(anchor_piece, funcCreatePiece, options){
            /* create Annot */
            var annotid = new Date(r2App.cur_time).toISOString();
            r2App.cur_recording_annot = new r2.Annot();
            r2App.cur_recording_annot.SetAnnot(
                annotid, anchor_piece.GetId(), r2App.cur_time, r2App.cur_time, [], r2.userGroup.cur_user.name, ""
            );
            r2App.annots[annotid] = r2App.cur_recording_annot;

            r2.localLog.event('recordingBgn', annotid);

            /* set context */
            r2App.cur_recording_anchor_piece = anchor_piece;
            r2App.cur_recording_pieceaudios = [];
            r2App.cur_recording_piece = null;

            /* create piece */
            funcCreatePiece(anchor_piece, annotid, options).then(
                function(){
                    /* begin audio recording */
                    r2.audioRecorder.BgnRecording();

                    /* update system variables */
                    if(options.piece_to_insert){
                        r2.dom_model.cbRecordingBgn(options.piece_to_insert.GetAnnotId(), 'fa-stop');
                    }
                    r2.dom.enableRecordingIndicators();
                    r2App.mode = r2App.AppModeEnum.RECORDING;
                }
            ).catch(
                function(err){
                    console.error(err);
                }
            );

            r2App.invalidate_size = true;
            r2App.invalidate_page_layout = true;
        };

        var createPieceAudio = function(anchor_piece, annotid){
            return new Promise(function(resolve, reject){
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
                r2App.cur_recording_piece = pieceaudio;
                anchor_piece.AddChildrenAtFront(r2App.cur_recording_pieceaudios);

                /* update dom with the object */
                r2.dom_model.createCommentVoice(r2App.cur_recording_annot, r2App.cur_pdf_pagen, true); /* live_recording = true */
                r2.dom_model.appendPieceVoice(annotid, 0, r2App.cur_recording_annot.GetBgnTime(), pieceaudio);
                resolve();
            });
        };

        var createPieceTranscription = function(anchor_piece, recording_annot_id, options){
            return new Promise(function(resolve, reject){

                var NewPieceType = null;
                var setPieceFunc = '';
                if(options.ui_type === r2App.RecordingUI.NEW_SPEAK){
                    NewPieceType = r2.PieceNewSpeak;
                    setPieceFunc = r2.PieceNewSpeak.prototype.SetPieceNewSpeak;
                }
                else if(
                    options.ui_type === r2App.RecordingUI.SIMPLE_SPEECH ||
                    options.ui_type === r2App.RecordingUI.WAVE_WEAVER
                ){
                    NewPieceType = r2.PieceSimpleSpeech;
                    setPieceFunc = r2.PieceSimpleSpeech.prototype.SetPieceSimpleSpeech;
                }

                var piece_simple_speech = null;
                if(options.piece_to_insert){
                    piece_simple_speech = options.piece_to_insert;
                }
                else{
                    var time_simple_speech = r2App.cur_time+128;
                    var piece_annot_id = new Date(time_simple_speech).toISOString();
                    var piece_annot = new r2.Annot();
                    piece_annot.SetAnnot(
                        piece_annot_id, anchor_piece.GetId(), time_simple_speech, time_simple_speech, [], r2.userGroup.cur_user.name, ""
                    );
                    r2App.annots[piece_annot_id] = piece_annot;

                    piece_simple_speech = new NewPieceType();
                    piece_simple_speech.SetPiece(
                        r2.pieceHashId.voice(piece_annot_id, 0),
                        piece_annot.GetBgnTime(),
                        anchor_piece.GetNewPieceSize(),
                        anchor_piece.GetTTData()
                    );
                    setPieceFunc.bind(piece_simple_speech)(
                        anchor_piece.GetId(),
                        piece_annot_id,
                        r2.userGroup.cur_user.name,
                        '',
                        true, // live_recording
                        options.ui_type
                    );

                    anchor_piece.AddChildAtFront(piece_simple_speech);
                }

                r2App.cur_recording_piece = piece_simple_speech;
                piece_simple_speech.bgnCommenting(recording_annot_id);

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
                            reject(err);
                        } else {
                            resolve();
                        }
                    },
                    function(msg){ // transcript
                        bluemix_stt.messageParser.run(msg);
                    },
                    function() { // closed
                        piece_simple_speech.doneCaptioning();
                    }
                );
            });
        };

        return pub;
    }());


    r2.recordingStop = (function(){
        var pub = {};
        pub.waveform = function(to_upload){
            run(to_upload, onPieceAudio);
        };
        pub.transcription = function(to_upload){
            run(to_upload, onPieceTranscription);
        };

        var run = function(to_upload, funcOn){
            // stop recording mode
            r2App.mode = r2App.AppModeEnum.IDLE;

            /* end audio recording */
            r2.audioRecorder.EndRecording().then(
                function(result){
                    r2.PieceAudio.prototype.NormalizePieceAudio(r2App.cur_recording_pieceaudios, refresh_all = true);

                    /* annot */
                    r2App.cur_recording_annot.SetRecordingAudioFileUrl(result.url, result.blob);
                    r2.localLog.event('recordingStop', r2App.cur_recording_annot, {'url': result.url});
                    r2.localLog.baseBlobURL(result.url, r2App.cur_recording_annot, r2App.cur_recording_piece.GetAnnotId());

                    if(r2App.cur_recording_piece.onEndRecording)
                        r2App.cur_recording_piece.onEndRecording(result.url);

                    /* upload */
                    if(to_upload)
                        r2Sync.PushToUploadCmd(r2App.cur_recording_annot.ExportToCmd());

                    /* update dom */
                    r2.dom.disableRecordingIndicators();

                    r2.dom_model.cbRecordingStop(r2App.cur_recording_piece.GetAnnotId());

                    /* release context */
                    r2App.cur_recording_annot = null;
                    r2App.cur_recording_pieceaudios = null;
                    r2App.cur_recording_piece = null;

                    r2App.invalidate_size = true;
                    r2App.invalidate_page_layout = true;
                    r2App.invalidate_dynamic_scene = true;
                    r2App.invalidate_static_scene = true;

                    funcOn();
                }
            );
        };

        var onPieceAudio = function(){
        };

        var onPieceTranscription = function(){
            $.publish('hardsocketstop');
        };

        return pub;
    }());

    r2.recordingUpdate = function(){
        var l = r2.audioRecorder.getRecorder().getPower();
        var dbs = l[l.length-1];
        //console.log(dbs, l.length);
        {
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
                r2App.cur_recording_piece = pieceaudio;
                anchorpiece.AddChildrenAtFront(r2App.cur_recording_pieceaudios);

                r2App.invalidate_size = true;
                r2App.invalidate_page_layout = true;
                r2App.invalidate_dynamic_scene = true;
                r2App.invalidate_static_scene = true;

                /* dom */
                r2.dom_model.appendPieceVoice(annot.GetId(), npiece-1, r2App.cur_recording_annot.GetBgnTime(), pieceaudio);
            }
            r2.PieceAudio.prototype.NormalizePieceAudio(r2App.cur_recording_pieceaudios, refresh_all = false);
        }
    };
}(window.r2 = window.r2 || {}));
