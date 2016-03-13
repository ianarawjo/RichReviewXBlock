
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

        // Listener callbacks
        /**
         * Callback when a change occurs to the EditHistory.
         */
        pub.onchange = null;

        /**
         * Fired when element is removed.
         * Function in form (index, uid, word).
         */
        pub.onremove = null;

        /**
         * Fired when element is inserted into the DOM.
         * Function in form (index, uid, word).
         */
        pub.oninsert = null;

        /**
         * Fired when element text is modified.
         * Function in form (index, uid, word).
         */
        pub.onreplace = null;

        /**
         * Fired when elements are first added (immediately after transcription).
         * Function in form ([uid, word]).
         */
        pub.onset = null;

        pub.on_input = null;
        pub.play = null;

        // Init
        var _init = function() {

            // Setup event handlers
            $textbox[0].addEventListener('keydown', onKeyDown);
        };

        pub.setCaptionTemporary = function(words){
            removeTempTalkens();
            words.forEach(function(data){
                var $ct = createTalken(
                    {
                        word: data[0],
                        bgn: data[1],
                        end: data[2]
                    },
                    true
                ); // is_temp = true
                insertPauseTalken($textbox.children().last(), $ct, true);
                $textbox.append($ct);
            });
            renderViewTalkens();
            content_changed = true;
        };
        pub.setCaptionFinal = function(words){
            removeTempTalkens();
            words.forEach(function(data){
                var $ct = createTalken(
                    {
                        word: data[0],
                        bgn: data[1],
                        end: data[2]
                    },
                    false
                ); // is_temp = false
                insertPauseTalken($textbox.children().last(), $ct, false);
                $textbox.append($ct);
            });
            renderViewTalkens();
            content_changed = true;
        };
        pub.getCtrlTalkens = function(url){
            var rtn = [];
            setRenderedTiming();
            $textbox.children().each(function(idx){
                this.base_data.audio_url = url;
                rtn.push(this.base_data);
            });
            return rtn;
        };
        var getCarretRenderedTime = function(carret){
            setRenderedTiming();
            return $textbox.children('span')[carret.idx_bgn].rendered_data.bgn*1000.;
        };
        var setRenderedTiming = function(){
            var rendered_time = 0;
            $textbox.children().each(function(idx){
                this.rendered_data = {};
                this.rendered_data.bgn = rendered_time;
                rendered_time += this.base_data.end-this.base_data.bgn;
                this.rendered_data.end = rendered_time;
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
        pub.synthesizeNewAnnot = function(_annot_id, annotids){
            return r2.audioSynthesizer.run(
                pub.getCtrlTalkens(annotids[0])
            ).then(
                function(result){
                    r2App.annots[_annot_id].SetRecordingAudioFileUrl(result.url, result.blob);
                    content_changed = false;
                    return null;
                }
            );
        };
        pub.isContentChanged = function(){
            return content_changed;
        };

        var insertPauseTalken = function($last, $ct, is_temp){
            if($last[0]){
                if($ct[0].base_data.bgn-$last[0].base_data.end > 0.3){
                    var $ct = createTalken(
                        {
                            word:'\xa0',
                            bgn: $last[0].base_data.end,
                            end:$ct[0].base_data.bgn
                        },
                        is_temp // is_temp
                    );
                    $ct[0].$vt.addClass('ssui-pause');
                    $textbox.append($ct);
                }
            }
        };

        var createTalken = function(base_data, is_temp){
            function newViewTalken(uid, word) {
                var $vt = $(document.createElement('div'));
                $vt.addClass('ssui-viewtalken');
                $vt.attr('uid', uid);

                var $vt_span = $(document.createElement('span'));
                $vt_span.addClass('ssui-viewtalken-span');
                $vt_span.text(word);
                $vt.append($vt_span);

                if (word.indexOf('\xa0') === -1){
                    $vt.addClass('ssui-word'); // blue if not a space
                }
                else{
                    $vt.addClass('ssui-pause');
                }
                return $vt;
            }
            function newCtrlTalken($vt, uid, word) {
                var $ct = $(document.createElement('span'));
                $ct.addClass('ssui-ctrltalken');
                $ct.text('\xa0');

                $ct[0].base_data = base_data;
                $ct[0].$vt = $vt; // cache the view_talken corresponding to this ctrl_talken
                $ct[0].$vt_rect = $vt[0].getBoundingClientRect();
                $ct.css('letter-spacing', transferPx2Em($ct[0].$vt_rect.width, r2Const.SIMPLESPEECH_FONT_SIZE));
                $ct.attr('uid', uid);
                $ct.attr('word', word);

                return $ct;
            }

            var uid = r2.util.generateGuid();

            var $vt = newViewTalken(uid, base_data.word);
            $overlay.append($vt);

            var $ct = newCtrlTalken($vt, uid, base_data.word);

            if(is_temp){
                $vt.toggleClass('temp', true);
                $ct.toggleClass('temp', true);
            }

            return $ct;
        };

        var removeTempTalkens = function(){
            $overlay.find('.temp').remove();
            $textbox.find('.temp').remove();
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

        // Events
        var onKeyDown = function(e) {
            var key_enable_default = [
                r2.keyboard.CONST.KEY_LEFT,
                r2.keyboard.CONST.KEY_RGHT,
                r2.keyboard.CONST.KEY_UP,
                r2.keyboard.CONST.KEY_DN
            ];

            if(key_enable_default.indexOf(e.keyCode) > -1){

            }
            else {
                e.preventDefault();
                var carret = getCarret();

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
                }
                else if(r2.keyboard.modifier_key_dn && e.keyCode === r2.keyboard.CONST.KEY_V){
                    if(carret.is_collapsed){
                        op.paste(
                            carret.idx_focus
                        );
                    }
                    else{
                        op.remove(
                            carret.idx_bgn,
                            carret.idx_end
                        );
                        op.paste(
                            carret.idx_bgn
                        );
                    }
                }
                else if(e.keyCode === r2.keyboard.CONST.KEY_SPACE){
                    if(r2App.mode === r2App.AppModeEnum.REPLAYING){
                        r2.rich_audio.stop();
                    }
                    else if(r2App.mode === r2App.AppModeEnum.IDLE){
                        var ctrl_talkens = $textbox.children('span');
                        if(carret.idx_bgn < ctrl_talkens.length){
                            pub.synthesizeAndPlay(content_changed, getCarretRenderedTime(carret)).then(
                                function(){
                                    content_changed = false;
                                }
                            );
                        }
                    }
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
                }

                renderViewTalkens();

                content_changed = true;
                if(pub.on_input)
                    pub.on_input();
            }
        };

        var getCarret = function(e){
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
            if(idx!==0){
                var n = $textbox.children()[idx-1];
                range.setStartAfter(n);
            }
            else{
                var n = $textbox.children()[0];
                range.setStartBefore(n);
            }
            sel.removeAllRanges();
            sel.addRange(range);
            return sel;
        };

        var op = (function(){
            var pub_op = {};

            pub_op.remove = function(idx_bgn, idx_end){ // remove [idx_bgn,idx_end), note that 'idx_end' item is not included
                console.log('remove', idx_bgn, idx_end);
                $textbox.children().slice(idx_bgn, idx_end).remove();
            };

            pub_op.copy = function(idx_bgn, idx_end){
                copied_ctrl_talkens = $textbox.children().slice(idx_bgn, idx_end);
            };

            pub_op.paste = function(idx){

                function jquery_insert($target, $elem, idx){
                    var idx_last = $target.children().size();
                    $target.append($elem);
                    if (idx < idx_last) {
                        $target.children().eq(idx).before($target.children().last())
                    }
                }

                copied_ctrl_talkens.each(
                    function(){
                        jquery_insert($textbox, createTalken(this.base_data, false), idx);
                        ++idx;
                    }
                );
                setCarret(idx);
            };

            return pub_op;
        }());

        _init();

        return pub;
    };

}(window.simplespeech = window.simplespeech || {}));
