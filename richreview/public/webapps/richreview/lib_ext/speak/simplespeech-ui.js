
/**
 * Simplespeech-UI
 * An implementation of SS's UI as a contenteditable div.
 * This is the 'View' in MVC paradigm.
 * @module simplespeech
 * @requires jQuery
 * @author ian
 * Created by ian on 03/01/2016.
 */
(function(simplespeech) {
    'use strict';

    simplespeech.ui = function(_textbox, _overlay, _annotid, _annotids) {
        var pub = {};

        // DOM elements
        var $textbox = $(_textbox);
        var $overlay = $(_overlay);
        var carret = {
            idx_anchor: 0,
            idx_focus: 0,
            is_collapsed: true,
            idx_bgn: 0,
            idx_end: 0
        };
        var copied_ctrl_talkens = null;
        var content_changed = false;
        var insert_pos = 0;
        var is_recording_and_synthesizing = false;
        var annotid_copy = _annotid; // The r2.Annot id of the SimpleSpeech piece. This is a copy from the piece's this._annotid.
        var annotids_copy = _annotids; // The list ([]) of r2.Annot ids for the base recordings. This is a copy from the piece's this._annotids.
        var base_data_buf = [];

        // Listener callbacks
        pub.on_input = null;
        pub.bgn_streaming = null;
        pub.end_streaming = null;

        pub.isContentChanged = function(){
            return content_changed;
        };

        // Init
        var _init = function() {
            // Setup event handlers
            $textbox[0].addEventListener('keyup', function(e) {
                checkCarretPositionUpdate(e);
                //r2.localLog.event('keyup', annotid_copy, {'range':[carret.idx_bgn, carret.idx_end]});
            });
            $textbox[0].addEventListener('click', function(e) {
                checkCarretPositionUpdate(e);
                //r2.localLog.event('click', annotid_copy, {'range':[carret.idx_bgn, carret.idx_end]});
            });
            $textbox[0].addEventListener('focus', function(e) {
                checkCarretPositionUpdate(e);
                r2.localLog.event('focus', annotid_copy);
            });
            $textbox[0].addEventListener('blur', function(e) {
                r2.localLog.event('blur', annotid_copy);
            });

            $textbox[0].addEventListener('keydown', onKeyDown);
            $textbox[0].addEventListener('keypress', onKeyPress);
        };

        pub.setCaptionTemporary = function(words, annotid){
            ;
        };
        pub.setCaptionFinal = function(words, annotid){
            words.forEach(function(data){
                var next_base_data = {
                    word: data[0],
                    data: [{
                        word: data[0],
                        bgn: data[1],
                        end: data[2],
                        annotid: annotid
                    }]
                };
                base_data_buf.push(next_base_data);
            });
        };
        function flushBaseDataBuf(){
            base_data_buf.forEach(function(datum){
                var pause_talken_datum = getPauseTalkenDatum($textbox.children().filter(':not(.old-recording)').last(), datum.data[0]);
                if(pause_talken_datum){
                    insertNewTalken(pause_talken_datum, insert_pos++, false, true); // is_temp = false, is_fresh = true
                    punctuationUtil.periodForPause(insert_pos-2);
                }
                if(punctuationUtil.toCapitalize(insert_pos)){
                    datum.word = datum.word.charAt(0).toUpperCase() + datum.word.slice(1)
                }
                insertNewTalken(datum, insert_pos++, false, true); // is_temp = false, is_fresh = true
                setCarret(insert_pos);
            });
            base_data_buf = [];
            renderViewTalkens();
            content_changed = true;
            talkenRenderer.invalidate();
        }
        pub.bgnCommenting = function(){
            r2.localLog.event('bgn-commenting', annotid_copy, {'range':[insert_pos], 'all_text':getAllText()}); // fixMe
            is_recording_and_synthesizing = true;
            r2App.is_recording_or_transcribing = true;
            $textbox.focus();

            $textbox.children('span').each(function(idx) {
                this.$vt.toggleClass('fresh-recording', false);
                $(this).toggleClass('fresh-recording', false);
                $(this).toggleClass('old-recording', true);
            });

            insert_pos = getCarret().idx_anchor;
            insertRecordingIndicator(insert_pos++, false);

            r2.tooltipAudioWaveform.show($textbox.parent(), getPopUpPos(insert_pos-1, insert_pos));

            renderViewTalkens();
        };
        pub.endCommenting = function(){
            r2.localLog.event('end-commenting', annotid_copy, {'range':[insert_pos], 'all_text':getAllText()}); // fixMe

            $overlay.find('.ssui-recording-indicator-talken').remove();
            $textbox.find('.ssui-recording-indicator-talken').remove();
            insert_pos-=1;
            r2.tooltipAudioWaveform.dismiss();

            flushBaseDataBuf();

            punctuationUtil.periodForEndCommenting(insert_pos-1);

            $textbox.children('span').each(function(idx) {
                $(this).toggleClass('old-recording', false);
            });

            r2App.is_recording_or_transcribing = false;
        };

        pub.drawDynamic = function(duration){
            if(r2App.mode === r2App.AppModeEnum.REPLAYING){
                $textbox.children().each(function(idx){
                    if(this.rendered_data.bgn < duration/1000. && duration/1000. < this.rendered_data.end){
                        this.$vt.toggleClass('replay_highlight', true);
                        setCarret(idx+1);
                    }
                    else{
                        this.$vt.toggleClass('replay_highlight', false);
                    }
                });
            }
            else{
                $textbox.children().each(function(idx){
                    this.$vt.toggleClass('replay_highlight', false);
                });
            }
        };
        pub.synthesizeNewAnnot = function(_annot_id){
            pub.bgn_streaming();
            return r2.audioSynthesizer.run(talkenRenderer.getCtrlTalkens()).then(
                function(result){
                    r2.localLog.event('rendered-audio', _annot_id, {'url':result.url, all_text: getAllText()});
                    r2.localLog.editedBlobURL(result.url, _annot_id);
                    r2App.annots[_annot_id].SetRecordingAudioFileUrl(result.url, result.blob);
                    return null;
                }
            ).then(
                function(){
                    r2.localLog.event('synth-gesture', _annot_id);
                    r2.gestureSynthesizer.run(_annot_id, talkenRenderer.getCtrlTalkens_Gesture()).then(
                        function(){
                            r2.localLog.event('end-synthesis', annotid_copy, {'annot': r2App.annots[annotid_copy]}); // fixMe
                            return null;
                        }
                    );;
                    is_recording_and_synthesizing = false;
                    content_changed = false;
                    pub.end_streaming();
                    return null;
                }
            );
        };

        var punctuationUtil = (function(){
            var pub_pu = {};

            pub_pu.toCapitalize = function(pos){
                pos -= 1;
                while(pos >= 0 && $textbox.children('span')[pos].talken_data.word === '\xa0'){
                    pos -= 1;
                }
                if(pos < 0){
                    return true;
                }
                else {
                    // check if the prior word ends with '.'
                    var w = $textbox.children('span')[pos].talken_data.word;
                    if (w[w.length - 1] === '.') {
                        return true;
                    }
                    else {
                        return false;
                    }
                 }
            };

            pub_pu.periodForPause = function(pos){
                if(pos < 0){return;}
                var rd = $textbox.children('span')[pos+1].talken_data.data;
                if(rd[rd.length-1].end-rd[0].bgn > 1.0){
                    putPeriod(pos);
                }
            };

            pub_pu.periodForEndCommenting = function(pos){
                if(pos < 0){return;}
                putPeriod(pos);
                renderViewTalkens();
            };

            pub_pu.capitalize = function(){
            };

            function putPeriod(pos){
                var datum = $textbox.children('span')[pos].talken_data;
                datum.word += '.';
                replaceTalken(datum, pos);
            }

            return pub_pu;
        }());

        var talkenRenderer = (function(){
            var pub_tr = {};

            var invalidated = true;

            pub_tr.invalidate = function(){
                invalidated = true;
            };

            pub_tr.getCtrlTalkens = function(){
                if(invalidated){render();}

                var rtn = [];
                $textbox.children().each(function(){
                    this.talken_data.data.forEach(function(datum){
                        rtn.push(datum);
                    });
                });
                return rtn;
            };

            pub_tr.getCtrlTalkens_Gesture = function(){
                if(invalidated){render();}

                var rtn = [];
                $textbox.children().each(function(){
                    this.talken_data.data.forEach(function(datum){
                        rtn.push({
                            base_annotid: datum.annotid,
                            base_bgn: datum.bgn,
                            base_end: datum.end,
                            new_bgn: datum.rendered_bgn,
                            new_end: datum.rendered_end,
                            word: datum.word
                        });
                    });
                });
                return rtn;
            };

            pub_tr.getRenderedTime = function(idx){
                if(invalidated){render();}

                return $textbox.children('span')[idx].rendered_data.bgn*1000.+10.;
            };

            var render = function(){
                var t = 0;
                $textbox.children().each(function(){
                    this.rendered_data = {};
                    this.rendered_data.bgn = t;
                    this.talken_data.data.forEach(function(datum){
                        datum.audio_url = r2App.annots[datum.annotid].GetAudioFileUrl();
                        datum.rendered_bgn = t;
                        t += datum.end - datum.bgn;
                        datum.rendered_end = t;
                    });
                    this.rendered_data.end = t;
                });
                invalidated = false;
            };

            return pub_tr;
        }());

        var getPauseTalkenDatum = function($last, next_base_datum){
            if($last[0]){
                var last_base_datum = $last[0].talken_data.data[$last[0].talken_data.data.length-1];
                if(next_base_datum.bgn-last_base_datum.end > 0.03){ // 30 ms to be consistent with Newspeak.
                    return {
                        word: '\xa0',
                        data: [{
                            word:'\xa0',
                            bgn: last_base_datum.end,
                            end: next_base_datum.bgn,
                            annotid: next_base_datum.annotid
                        }]
                    };
                }
            }
        };

        var replaceTalken = function(talken_data, idx){
            var was_fresh = $($textbox.children()[idx]).hasClass('fresh-recording');
            $textbox.children().slice(idx, idx+1).remove();
            insertNewTalken(talken_data, idx, false, was_fresh);
            talkenRenderer.invalidate();
            setCarret(idx+1);
        };

        var insertNewTalken = function(talken_data, idx, is_temp, is_fresh){
            is_fresh = typeof is_fresh === 'undefined' ? false : is_fresh; // default false

            r2.util.jqueryInsert($textbox, createTalken(talken_data, is_temp), idx);

            function createTalken(talken_data, is_temp){
                var uid = r2.util.generateGuid();
                var word;
                if(typeof talken_data.word === 'string'){
                    word = talken_data.word;
                }
                else{
                    word = talken_data.data.map(function(datum){return datum.word;}).join(' ').replace(/\s+/g, '\xa0').trim();
                }

                var $vt = newViewTalken(uid, word);
                $overlay.append($vt);
                var $ct = newCtrlTalken($vt, uid);
                if(is_temp){
                    $vt.toggleClass('temp', true);
                    $ct.toggleClass('temp', true);
                }
                if(is_fresh){
                    $vt.toggleClass('fresh-recording', true);
                    $ct.toggleClass('fresh-recording', true);
                }
                return $ct;
            }

            function newViewTalken(uid, word) {
                var $vt = $(document.createElement('div'));
                $vt.addClass('ssui-viewtalken');
                $vt.attr('uid', uid);

                var $vt_span = $(document.createElement('span'));
                $vt_span.addClass('ssui-viewtalken-span');
                $vt_span.text(word);
                $vt.append($vt_span);

                if (word === ('\xa0')){
                    $vt.addClass('ssui-pause');
                    $vt_span.text('');
                    $vt.css('padding-right', (talken_data.data[talken_data.data.length-1].end-talken_data.data[0].bgn-0.3)*0.25+'em');
                }
                else{
                    $vt.addClass('ssui-word');
                }
                return $vt;
            }

            function newCtrlTalken ($vt, uid) {
                var CTRL_TKN_MARGIN = 0.1;
                var $ct = $(document.createElement('span'));
                $ct.addClass('ssui-ctrltalken');
                $ct.text('\xa0');

                $ct[0].talken_data = talken_data;
                $ct[0].$vt = $vt; // cache the view_talken corresponding to this ctrl_talken
                $ct[0].$vt_rect = $vt[0].getBoundingClientRect();
                $ct.css('letter-spacing',
                    (transferPx2EmNumeric($ct[0].$vt_rect.width, r2Const.SIMPLESPEECH_FONT_SIZE)-spaceWidth.get()+CTRL_TKN_MARGIN)+'em');
                $ct.attr('uid', uid);

                return $ct;
            }
        };

        var spaceWidth = (function(){
            var pub_sw = {};

            var w = -1; // in em.

            pub_sw.get = function(){
                if(w < 0){
                    init();
                }
                return w;
            };

            function init(){
                var $ct = $(document.createElement('span'));
                $ct.addClass('ssui-ctrltalken');
                $ct.text('\xa0');
                $textbox.append($ct);
                w = transferPx2EmNumeric($ct[0].getBoundingClientRect().width, r2Const.SIMPLESPEECH_FONT_SIZE);
                $ct.remove();
            }

            return pub_sw;
        }());

        var insertRecordingIndicator = function(idx){

            var indicator_character = ' ';
            r2.util.jqueryInsert($textbox, createTalken(), idx);

            function createTalken(){
                var uid = r2.util.generateGuid();
                var word = indicator_character;

                var $vt = newViewTalken(uid, word);
                $overlay.append($vt);
                var $ct = newCtrlTalken($vt, uid);
                return $ct;
            }

            function newViewTalken(uid, word) {
                var $vt = $(document.createElement('div'));
                $vt.addClass('ssui-viewtalken');
                $vt.addClass('ssui-recording-indicator-talken');
                $vt.attr('uid', uid);

                var $vt_span = $(document.createElement('span'));
                $vt_span.addClass('ssui-viewtalken-span');
                $vt_span.text(word);
                $vt.append($vt_span);
                $vt.addClass('ssui-recording-indicator');
                $vt.addClass('blink_me');
                return $vt;
            }

            function newCtrlTalken ($vt, uid) {
                var $ct = $(document.createElement('span'));
                $ct.addClass('ssui-ctrltalken');
                $ct.addClass('ssui-recording-indicator-talken');

                $ct.text('\xa0');

                $ct[0].talken_data = {
                    word: indicator_character,
                    data: [{
                        word: indicator_character,
                        bgn: 0,
                        end: 0,
                        annotid: _annotid
                    }]
                };
                $ct[0].$vt = $vt; // cache the view_talken corresponding to this ctrl_talken
                $ct[0].$vt_rect = $vt[0].getBoundingClientRect();
                $ct.css('letter-spacing', transferPx2Em($ct[0].$vt_rect.width, r2Const.SIMPLESPEECH_FONT_SIZE));
                $ct.attr('uid', uid);

                return $ct;
            }
        };


        var renderViewTalkens = function(){
            var arrayDiff = function(a, b) {
                return a.filter(function(i) {
                    return b.index(i) < 0;
                });
            };

            var positionViewTalken = function($ctrl_talken, $edit_box){
                var $vt = $ctrl_talken[0].$vt;

                var ct_rect = $ctrl_talken[0].getBoundingClientRect();
                var eb_rect = $edit_box[0].getBoundingClientRect();

                var dx = (ct_rect.width-$ctrl_talken[0].$vt_rect.width)*0.5;
                $vt.css('left', transferPx2Em(ct_rect.left - eb_rect.left + dx, 1.0));
                $vt.css('top', transferPx2Em(ct_rect.top - eb_rect.top, 1.0));
            };

            var overlay_uids = $overlay.children('.ssui-viewtalken').map(function(idx){
                return $(this).attr('uid');
            });
            var textbox_uids = $textbox.children('.ssui-ctrltalken').map(function(idx){
                return $(this).attr('uid');
            });

            var to_remove = arrayDiff(overlay_uids, textbox_uids);
            var to_append = arrayDiff(textbox_uids, overlay_uids);

            to_remove.each(function(uid){
                $overlay.find(".ssui-viewtalken[uid='"+to_remove[uid]+"']").remove();
            });

            to_append.each(function(uid){
                $overlay.append(
                    $textbox.find(".ssui-ctrltalken[uid='"+to_append[uid]+"']")[0].$vt
                );
            });

            $textbox.children('span').each(function(idx) {
                positionViewTalken($(this), $textbox);
            });
        };

        function transferPx2Em(px, this_font_size){
            return transferPx2EmNumeric(px, this_font_size) + 'em';
        }

        function transferPx2EmNumeric(px, this_font_size){
            return px*r2Const.FONT_SIZE_SCALE/r2.dom.getCanvasWidth()/this_font_size;
        }

        function getSelectedText() {
            getSelectedTextRange(carret.idx_bgn, carret.idx_end);
        }
        function getSelectedTextRange(bgn, end){
            var l = [];
            $textbox.children('span').slice(bgn, end).each(function() {
                l.push(this.talken_data);
            });
            return {
                text: l.map(function(datum){return datum.word;}).join(' '),
                list: l
            };
        }
        function getAllText(){
            var l = [];
            $textbox.children('span').each(function() {
                l.push(this.talken_data);
            });
            return {
                text: l.map(function(datum){return datum.word;}).join(' '),
                list: l
            };
        }
        function getCopiedText(){
            var l = [];
            if(copied_ctrl_talkens){
                copied_ctrl_talkens.each(function(){
                    l.push(this.talken_data);
                });
            }
            return {
                text: l.map(function(datum){return datum.word;}).join(' '),
                list: l
            };
        }

        var onKeyDown = function(e) {
            //console.log('onKeyDown');
            //r2.localLog.event('keydown', annotid_copy, {'key':e.keyCode, 'carret':[carret.idx_bgn, carret.idx_end]});

            var key_enable_default = [
                r2.keyboard.CONST.KEY_LEFT,
                r2.keyboard.CONST.KEY_RGHT,
                r2.keyboard.CONST.KEY_UP,
                r2.keyboard.CONST.KEY_DN
            ];

            if(key_enable_default.indexOf(e.keyCode) > -1){
            }
            else {
                if(e.keyCode === r2.keyboard.CONST.KEY_DEL) {
                    if(carret.is_collapsed){
                        op.remove(
                            carret.idx_bgn,
                            carret.idx_end+1
                        );
                    }
                    else{
                        op.remove(
                            carret.idx_bgn,
                            carret.idx_end
                        );
                    }
                    e.preventDefault();
                }
                else if(e.keyCode === r2.keyboard.CONST.KEY_BSPACE) {
                    if(carret.is_collapsed){
                        r2.localLog.event('remove-collapsed', annotid_copy, {'range':[carret.idx_bgn-1, carret.idx_end]});
                        op.remove(
                            carret.idx_bgn-1,
                            carret.idx_end
                        );
                    }
                    else{
                        r2.localLog.event('remove-not-collapsed', annotid_copy, {'range':[carret.idx_bgn, carret.idx_end], 'selected_text':getSelectedText()});
                        op.remove(
                            carret.idx_bgn,
                            carret.idx_end
                        );
                    }
                    e.preventDefault();
                }
                else if(r2.keyboard.modifier_key_dn && e.keyCode === r2.keyboard.CONST.KEY_C){
                    if(carret.is_collapsed){
                        r2.localLog.event('copy-err', annotid_copy, {'reason':'caret is collapsed'});
                    }
                    else{
                        r2.localLog.event('copy', annotid_copy, {'range':[carret.idx_bgn, carret.idx_end], 'selected_text':getSelectedText()});
                        op.copy(
                            carret.idx_bgn,
                            carret.idx_end
                        );
                    }
                    e.preventDefault();
                }
                else if(r2.keyboard.modifier_key_dn && e.keyCode === r2.keyboard.CONST.KEY_X){
                    if(carret.is_collapsed){
                        r2.localLog.event('cut-err', annotid_copy, {'reason':'caret is collapsed'});
                    }
                    else{
                        r2.localLog.event('cut', annotid_copy, {'range':[carret.idx_bgn, carret.idx_end], 'selected_text':getSelectedText()});
                        op.copy(
                            carret.idx_bgn,
                            carret.idx_end
                        );
                        op.remove(
                            carret.idx_bgn,
                            carret.idx_end
                        );
                    }
                    e.preventDefault();
                }
                else if(r2.keyboard.modifier_key_dn && e.keyCode === r2.keyboard.CONST.KEY_V){
                    if(!carret.is_collapsed){
                        r2.localLog.event('paste-remove', annotid_copy, {'range':[carret.idx_bgn, carret.idx_end], 'copied_text':getCopiedText()});
                        op.remove(
                            carret.idx_bgn,
                            carret.idx_end
                        );
                    }
                    op.paste(
                        carret.idx_bgn
                    );
                    r2.localLog.event('paste', annotid_copy, {'range':[carret.idx_bgn, carret.idx_end], 'copied_text':getCopiedText()});
                    e.preventDefault();
                }
                else if(e.keyCode === r2.keyboard.CONST.KEY_SPACE){
                    if(r2App.mode === r2App.AppModeEnum.REPLAYING){
                        r2.localLog.event('cmd-stop-space', annotid_copy, {'input': 'key-space'});
                        r2.rich_audio.stop();
                    }
                    else if(r2App.mode === r2App.AppModeEnum.IDLE){
                        var ctrl_talkens = $textbox.children('span');
                        if(carret.idx_focus < ctrl_talkens.length){
                            r2.localLog.event('cmd-play', annotid_copy, {'input': 'key-space', 'cursor_pos': carret.idx_focus});
                            pub.synthesizeAndPlay(content_changed, talkenRenderer.getRenderedTime(carret.idx_focus)).then(
                                function(){
                                    content_changed = false;
                                }
                            );
                        }
                    }
                    e.preventDefault();
                }
                else if(e.keyCode === r2.keyboard.CONST.KEY_ENTER) {
                    if (r2App.mode === r2App.AppModeEnum.RECORDING) {

                    }
                    else{
                        if (r2App.mode === r2App.AppModeEnum.REPLAYING) {
                            r2.localLog.event('cmd-audio-force-stop', annotid_copy, {'input': 'key-enter'});
                            r2.rich_audio.stop();
                        }
                        r2.localLog.event('cmd-insertion', annotid_copy, {'input': 'key-enter', 'cursor_pos': carret.idx_focus});
                        pub.insertRecording();
                    }
                    e.preventDefault();
                }
                else if(e.keyCode === r2.keyboard.CONST.KEY_ESC) {
                    if (r2App.mode === r2App.AppModeEnum.RECORDING) {
                        r2.localLog.event('cmd-stop', annotid_copy, {'input': 'key-esc'});
                        r2.recordingCtrl.stop(false); // to_upload = false
                    }
                    else{
                        if (r2App.mode === r2App.AppModeEnum.REPLAYING) {
                            r2.localLog.event('cmd-audio-force-stop', annotid_copy, {'input': 'key-esc'});
                            r2.rich_audio.stop();
                        }
                    }
                    e.preventDefault();
                }

                renderViewTalkens();
                if(pub.on_input)
                    pub.on_input();
            }
        };

        // Events
        var onKeyPress = function(event) {
            if(
                String.fromCharCode(event.which) === '.' ||
                String.fromCharCode(event.which) === ',' ||
                String.fromCharCode(event.which) === '?' ||
                String.fromCharCode(event.which).match(/\w/)
            ){ //alphanumeric
                r2.localLog.event('popup_transcription', annotid_copy, {'charCode': String.fromCharCode(event.which),'key': event.which});
                if(!popupTranscription(carret.idx_bgn, carret.idx_end)){
                    event.preventDefault();
                }
            }
            else{
                event.preventDefault();
            }
        };

        var popupTranscription = function(idx_bgn, idx_end, force_select_all){
            force_select_all = typeof force_select_all === 'undefined' ? false : force_select_all;
            var select_all = true;
            if(idx_bgn === idx_end){ // when collapsed
                idx_bgn -= 1;
                select_all = false || force_select_all;
                r2.localLog.event('cmd-edit-transcript-collapsed', annotid_copy);
            }
            if(0 <= idx_bgn && idx_bgn < idx_end && idx_end <= $textbox.children('span').length){
                var popup_word = getPopUpWord(idx_bgn, idx_end);
                r2.localLog.event('cmd-edit-transcript-popup', annotid_copy, {'text-before': popup_word, 'range': [idx_bgn, idx_end]});

                var tooltip = new r2.tooltip(
                    $textbox.parent(),
                    //with_blank_text ? '' : getPopUpWord(idx_bgn, idx_end),
                    popup_word,
                    getPopUpPos(idx_bgn, idx_end),
                    function(text){
                        var new_base_data = getNewBaseData(idx_bgn, idx_end, text);
                        op.remove(
                            idx_bgn,
                            idx_end
                        );

                        r2.localLog.event('cmd-edit-transcript-done', annotid_copy, {'text-after':text, 'text-before': popup_word});
                        insertNewTalken(new_base_data, idx_bgn, false);
                        renderViewTalkens();
                        $textbox.focus();
                        if(idx_bgn+1 < $textbox.children('span').length){
                            setCarret(idx_bgn+2);
                            getCarret();
                            if(!popupTranscription(carret.idx_bgn, carret.idx_end, true)){
                                event.preventDefault();
                            }
                        }
                    },
                    function(){
                        r2.localLog.event('cmd-edit-transcript-cancel', annotid_copy);
                        $textbox.focus();
                        setCarret(idx_end);

                    }
                );
                $textbox.blur();
                tooltip.focus();
                if(select_all){
                    console.log('selectAll');
                    tooltip.selectAll();
                }
                return true;
            }
            else{
                console.error('invalid caret range:', idx_bgn, idx_end);
                $textbox.focus();
                return false;
            }

            function getPopUpWord(idx_bgn, idx_end){
                var l = [];
                $textbox.children('span').slice(idx_bgn, idx_end).map(
                    function(){
                        l.push(this.talken_data.word);
                    }
                );
                return l.join('\xa0');
            }
            function getNewBaseData(idx_bgn, idx_end, word){
                var l = [];
                $textbox.children('span').slice(idx_bgn, idx_end).map(
                    function(){
                        this.talken_data.data.forEach(function(datum){
                            l.push(datum);
                        });
                    }
                );
                return {
                    word: word.replace(/\s+/g, '\xa0').trim(),
                    data: l
                };
            }
        };

        function getPopUpPos(idx_bgn, idx_end){
            var tb_bbox = $textbox[0].getBoundingClientRect();
            var l_bbox = $textbox.children('span')[idx_bgn].getBoundingClientRect();
            var r_bbox = $textbox.children('span')[idx_end-1].getBoundingClientRect();
            if(l_bbox.top === r_bbox.top){
                return {
                    x: ((l_bbox.left+r_bbox.right)*0.5-tb_bbox.left)*r2Const.FONT_SIZE_SCALE/r2.dom.getCanvasWidth() + 'em',
                    y: (r_bbox.top+r_bbox.height-tb_bbox.top)*r2Const.FONT_SIZE_SCALE/r2.dom.getCanvasWidth() + 'em'
                };
            }
            else{
                return {
                    x: (r_bbox.left+r_bbox.width*0.5-tb_bbox.left)*r2Const.FONT_SIZE_SCALE/r2.dom.getCanvasWidth() + 'em',
                    y: (r_bbox.top+r_bbox.height-tb_bbox.top)*r2Const.FONT_SIZE_SCALE/r2.dom.getCanvasWidth() + 'em'
                };
            }
        }

        var checkCarretPositionUpdate = function(event){
            if(is_recording_and_synthesizing){
                return;
            }

            var old_anchor = carret.idx_anchor;
            var old_focus = carret.idx_focus;
            getCarret();
            var is_changed = !(old_anchor === carret.idx_anchor && old_focus === carret.idx_focus);
            if(is_changed){
                r2.localLog.event('caret-change', annotid_copy, {'range':[carret.idx_bgn, carret.idx_end], 'selected_text':getSelectedText()});
                var ctrl_talkens = $textbox.children('span');
                if(carret.idx_focus < ctrl_talkens.length){
                    if(r2App.mode === r2App.AppModeEnum.IDLE){ // move the playhead
                        r2.rich_audio.jump(annotid_copy, talkenRenderer.getRenderedTime(carret.idx_focus));
                        r2App.invalidate_dynamic_scene = true;
                    }
                }
            }
            return is_changed;
        };

        var getCarret = function(){
            if($textbox.children().length === 0){
                return {idx_anchor:0};
            }
            var sel = window.getSelection();
            if(sel.anchorNode === null || sel.anchorNode.parentNode.parentNode !== $textbox[0]){ // when focused to textbox
                sel = setCarret(sel.anchorOffset);
            }
            carret.idx_anchor = sel.anchorOffset + $textbox.children().index($(sel.anchorNode.parentNode));
            carret.idx_focus = sel.focusOffset + $textbox.children().index($(sel.focusNode.parentNode));

            carret.is_collapsed = sel.isCollapsed;

            carret.idx_bgn = Math.min(carret.idx_anchor, carret.idx_focus);
            carret.idx_end = Math.max(carret.idx_anchor, carret.idx_focus);
            return carret;
        };

        var setCarret = function(idx){
            var sel = window.getSelection();
            var range = document.createRange();
            try{
                if(idx!==0){
                    var n = $textbox.children()[idx-1];
                    range.setStartAfter(n);
                }
                else{
                    var n = $textbox.children()[0];
                    range.setStartBefore(n);
                }
            }
            catch(err){
                console.error(err);
            }
            sel.removeAllRanges();
            sel.addRange(range);
            return sel;
        };

        var op = (function(){
            var pub_op = {};

            pub_op.remove = function(idx_bgn, idx_end){ // remove [idx_bgn,idx_end), note that 'idx_end' item is not included
                r2.localLog.event('op-remove', annotid_copy, {'range':[idx_bgn, idx_end], 'selected_text':getSelectedTextRange(idx_bgn, idx_end)}); // fixMe
                $textbox.children().slice(idx_bgn, idx_end).remove();
                content_changed = true;
                talkenRenderer.invalidate();
            };

            pub_op.copy = function(idx_bgn, idx_end){
                r2.localLog.event('op-copy', annotid_copy, {'range':[idx_bgn, idx_end], 'selected_text':getSelectedTextRange(idx_bgn, idx_end)}); //fixMe
                copied_ctrl_talkens = $textbox.children().slice(idx_bgn, idx_end);
                content_changed = true;
                talkenRenderer.invalidate();
            };

            pub_op.paste = function(idx){
                r2.localLog.event('op-paste', annotid_copy, {'index':idx, 'copied_text':getCopiedText()});
                if(copied_ctrl_talkens){
                    copied_ctrl_talkens.each(
                        function(){
                            insertNewTalken(this.talken_data, idx, false);
                            ++idx;
                        }
                    );
                }
                setCarret(idx);
                content_changed = true;
                talkenRenderer.invalidate();
            };

            return pub_op;
        }());

        _init();

        return pub;
    };

}(window.simplespeech = window.simplespeech || {}));
