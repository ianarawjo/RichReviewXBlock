
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

    simplespeech.ui = function(_textbox, _overlay) {
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
        var copied_ctrl_talkens = [];
        var content_changed = false;
        var insert_pos = 0;
        var is_recording_and_synthesizing = false;

        // Listener callbacks
        pub.on_input = null;
        pub.play = null;
        pub.movePlayHeader = null;
        pub.bgn_streaming = null;
        pub.end_streaming = null;

        // Init
        var _init = function() {
            // Setup event handlers
            $textbox[0].addEventListener('keyup', checkCarretPositionUpdate);
            $textbox[0].addEventListener('click', checkCarretPositionUpdate);
            $textbox[0].addEventListener('keydown', onKeyDown);
            $textbox[0].addEventListener('keypress', onKeyPress);
        };

        pub.setCaptionTemporary = function(words, annotid){
            removeTempTalkens();
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
                var pause_talken_datum = getPauseTalkenDatum($textbox.children().filter(':not(.old)').last(), next_base_data.data[0]);
                if(pause_talken_datum){
                    insertNewTalken(pause_talken_datum, insert_pos++, true);
                }

                insertNewTalken(next_base_data, insert_pos++, true);
            });
            renderViewTalkens();
            content_changed = true;
            talkenRenderer.invalidate();
        };
        pub.setCaptionFinal = function(words, annotid){
            removeTempTalkens();
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
                var pause_talken_datum = getPauseTalkenDatum($textbox.children().filter(':not(.old)').last(), next_base_data.data[0]);
                if(pause_talken_datum){
                    insertNewTalken(pause_talken_datum, insert_pos++, false);
                }
                insertNewTalken(next_base_data, insert_pos++, false);
                setCarret(insert_pos);
            });
            renderViewTalkens();
            content_changed = true;
            talkenRenderer.invalidate();
        };
        pub.bgnCommenting = function(){
            is_recording_and_synthesizing = true;
            r2App.is_recording_or_transcribing = true;
            $textbox.focus();
            $textbox.children('span').each(function(idx) {
                this.$vt.toggleClass('old', true);
                $(this).toggleClass('old', true);
            });
            insert_pos = getCarret().idx_anchor;
        };
        pub.endCommenting = function(){
            r2App.is_recording_or_transcribing = false;
            $textbox.children('span').each(function(idx) {
                this.$vt.toggleClass('old', false);
                $(this).toggleClass('old', false);
            });
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
                    r2App.annots[_annot_id].SetRecordingAudioFileUrl(result.url, result.blob);
                    return null;
                }
            ).then(
                function(){
                    r2.gestureSynthesizer.run(_annot_id, talkenRenderer.getCtrlTalkens_Gesture());
                    is_recording_and_synthesizing = false;
                    content_changed = false;
                    pub.end_streaming();
                    return null;
                }
            );
        };

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
                            new_bgn: datum.bgn,
                            new_end: datum.end,
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
                        t += datum.end - datum.bgn;
                    });
                    this.rendered_data.end = t;
                });
                invalidated = false;
            };

            return pub_tr;
        }());

        var removeTempTalkens = function(){
            $overlay.find('.temp').remove();
            insert_pos-=$textbox.find('.temp').length;
            $textbox.find('.temp').remove();
        };

        var getPauseTalkenDatum = function($last, next_base_datum){
            if($last[0]){
                var last_base_datum = $last[0].talken_data.data[$last[0].talken_data.data.length-1];
                if(next_base_datum.bgn-last_base_datum.end > 0.3){
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

        var insertNewTalken = function(talken_data, idx, is_temp){

            r2.util.jqueryInsert($textbox, createTalken(talken_data, is_temp), idx);

            function createTalken(talken_data, is_temp){
                var uid = r2.util.generateGuid();
                var word;
                if(talken_data.word){
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
                var $ct = $(document.createElement('span'));
                $ct.addClass('ssui-ctrltalken');
                $ct.text('\xa0');

                $ct[0].talken_data = talken_data;
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
            return px*r2Const.FONT_SIZE_SCALE/r2.dom.getCanvasWidth()/this_font_size+'em';
        }

        var onKeyDown = function(e) {
            //console.log('onKeyDown');
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
                        op.remove(
                            carret.idx_bgn-1,
                            carret.idx_end
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
                else if(r2.keyboard.modifier_key_dn && e.keyCode === r2.keyboard.CONST.KEY_C){
                    if(carret.is_collapsed){
                        ;
                    }
                    else{
                        op.copy(
                            carret.idx_bgn,
                            carret.idx_end
                        );
                    }
                    e.preventDefault();
                }
                else if(r2.keyboard.modifier_key_dn && e.keyCode === r2.keyboard.CONST.KEY_X){
                    if(carret.is_collapsed){
                        ;
                    }
                    else{
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
                        op.remove(
                            carret.idx_bgn,
                            carret.idx_end
                        );
                    }
                    op.paste(
                        carret.idx_bgn
                    );
                    e.preventDefault();
                }
                else if(e.keyCode === r2.keyboard.CONST.KEY_SPACE){
                    if(r2App.mode === r2App.AppModeEnum.REPLAYING){
                        r2.rich_audio.stop();
                    }
                    else if(r2App.mode === r2App.AppModeEnum.IDLE){
                        var ctrl_talkens = $textbox.children('span');
                        if(carret.idx_focus < ctrl_talkens.length){
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
                            r2.rich_audio.stop();
                        }
                        pub.insertRecording();
                    }
                    e.preventDefault();
                }
                else if(e.keyCode === r2.keyboard.CONST.KEY_ESC) {
                    if (r2App.mode === r2App.AppModeEnum.RECORDING) {
                        r2.recordingCtrl.stop(false); // to_upload = false
                    }
                    else{
                        if (r2App.mode === r2App.AppModeEnum.REPLAYING) {
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
            console.log(event);
            if(
                String.fromCharCode(event.which) === '.' ||
                String.fromCharCode(event.which) === ',' ||
                String.fromCharCode(event.which) === '?' ||
                String.fromCharCode(event.which).match(/\w/)
            ){ //alphanumeric
                if(!popupTranscription(carret.idx_bgn, carret.idx_end)){
                    event.preventDefault();
                }
            }
            else{
                event.preventDefault();
            }
        };

        var popupTranscription = function(idx_bgn, idx_end, force_blank){
            force_blank = typeof force_blank === 'undefined' ? false : true;
            var with_blank_text = true;
            if(idx_bgn === idx_end){ // when collapsed
                idx_bgn -= 1;
                with_blank_text = false || force_blank;
            }
            if(0 <= idx_bgn && idx_bgn < idx_end && idx_end <= $textbox.children('span').length){
                var tooltip = new r2.tooltip(
                    $textbox.parent(),
                    with_blank_text ? '' : getPopUpWord(idx_bgn, idx_end),
                    getPopUpPos(idx_bgn, idx_end),
                    function(text){
                        var new_base_data = getNewBaseData(idx_bgn, idx_end, text);
                        op.remove(
                            idx_bgn,
                            idx_end
                        );
                        insertNewTalken(new_base_data, idx_bgn, false);
                        renderViewTalkens();
                        $textbox.focus();
                        setCarret(idx_end+1);
                        getCarret();
                        if(!popupTranscription(carret.idx_bgn, carret.idx_end, true)){
                            event.preventDefault();
                        }
                    },
                    function(){
                        $textbox.focus();
                        setCarret(idx_end);
                    }
                );
                $textbox.blur();
                tooltip.focus();
                return true;
            }
            else{
                console.error('invalid caret range:', idx_bgn, idx_end);
                $textbox.focus();
                return false;
            }

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

        var checkCarretPositionUpdate = function(event){
            if(is_recording_and_synthesizing){
                return;
            }
            var old_anchor = carret.idx_anchor;
            var old_focus = carret.idx_focus;
            getCarret();
            var is_changed = !(old_anchor === carret.idx_anchor && old_focus === carret.idx_focus);
            if(is_changed){
                var ctrl_talkens = $textbox.children('span');
                if(carret.idx_focus < ctrl_talkens.length){
                    pub.movePlayHeader(talkenRenderer.getRenderedTime(carret.idx_focus));
                }
            }
            return is_changed;
        };

        var getCarret = function(){
            if($textbox.children().length === 0){
                return {idx_anchor:0};
            }
            var sel = window.getSelection();
            if(sel.anchorNode.parentNode.parentNode !== $textbox[0]){ // when focused to textbox
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
                $textbox.children().slice(idx_bgn, idx_end).remove();
                content_changed = true;
                talkenRenderer.invalidate();
            };

            pub_op.copy = function(idx_bgn, idx_end){
                copied_ctrl_talkens = $textbox.children().slice(idx_bgn, idx_end);
                content_changed = true;
                talkenRenderer.invalidate();
            };

            pub_op.paste = function(idx){
                copied_ctrl_talkens.each(
                    function(){
                        insertNewTalken(this.talken_data, idx, false);
                        ++idx;
                    }
                );
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
