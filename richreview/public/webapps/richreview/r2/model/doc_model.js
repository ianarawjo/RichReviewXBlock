/**
 * Created by yoon on 12/27/14.
 */
//written by Yuan Huang
//written by Tianwei Huang

/** @namespace r2 */
(function(r2){
    "use strict";

    /*
     * Obj
     */
    r2.Obj = function(){
        this.pos = new Vec2(0, 0); this.size = new Vec2(0, 0);
        this._parent = null;
        this.child = [];
        this._isvisible = true;
    };
    r2.Obj.prototype.RunRecursive = function(func_name, args){
        if(typeof this[func_name] !== 'undefined')
            this[func_name].apply(this, args);

        var i, child;
        for(i = 0; child = this.child[i]; ++i){
            child.RunRecursive(func_name, args);
        }
    };
    r2.Obj.prototype.AddChildAtBack = function(obj){
        obj.SetParent(this);
        this.child.push(obj);
    };
    r2.Obj.prototype.AddChildAtFront = function(obj){
        obj.SetParent(this);
        this.child.unshift(obj);
    };
    r2.Obj.prototype.AddChildrenChronologically = function(objs){
        var time = objs[0].GetCreationTime();
        var i = 0;
        for(; i < this.child.length; ++i){
            if(time > this.child[i].GetCreationTime()){
                break;
            }
        }
        var j = 0;
        for(; j < objs.length; ++j){
            objs[j].SetParent(this);
            this.child.splice(i+j, 0, objs[j]);
        }
    };
    r2.Obj.prototype.AddChildrenAtFront = function(objs){
        var i = 0;
        while(this.child[i] === objs[i]){
            ++i;
        }
        for(; i < objs.length; ++i){
            objs[i].SetParent(this);
            this.child.splice(i, 0, objs[i]);
        }
    };
    r2.Obj.prototype.SetParent = function(parent){
        this._parent = parent;
    };
    r2.Obj.prototype.GetParent = function(){
        return this._parent;
    };
    r2.Obj.prototype.SetVisibility = function(visible){
        this._isvisible = visible;
        this.child.forEach(function(child){
            child.SetVisibility(visible);
        });
    };
    r2.Obj.prototype.GetChild = function(i){
        return this.child[i];
    };
    r2.Obj.prototype.GetRegionType = function(){
        return this._parent.GetRegionType();
    };
    r2.Obj.prototype.DrawRect = function(color){
        r2.canv_ctx.strokeStyle = color;
        r2.canv_ctx.beginPath();
        r2.canv_ctx.lineWidth="0.002";
        r2.canv_ctx.rect(this.pos.x,this.pos.y,this.size.x,this.size.y);
        r2.canv_ctx.stroke();
    };
    r2.Obj.prototype.Relayout = function(){
        console.log("Relayout from r2.Obj");
    };
    r2.Obj.prototype.SearchPiece = function(id){
        var i, child;
        for(i = 0; child = this.child[i]; ++i){
            var rtn = child.SearchPiece(id);
            if (rtn){
                return rtn;
            }
        }
        return null;
    };
    r2.Obj.prototype.SearchPieceAudioByAnnotId = function(annotid, time){
        var i, child;
        for(i = 0; child = this.child[i]; ++i){
            var rtn = child.SearchPieceAudioByAnnotId(annotid, time);
            if (rtn){
                return rtn;
            }
        }
        return null;
    };
    r2.Obj.prototype.SearchPieceByAnnotId = function(annotid){
        var i, child;
        for(i = 0; child = this.child[i]; ++i){
            var rtn = child.SearchPieceByAnnotId(annotid);
            if (rtn){
                return rtn;
            }
        }
        return null;
    };
    r2.Obj.prototype.GatherPieceAudioByAnnotId = function(annotid){
        var rtn = [];
        var i, child;
        for(i = 0; child = this.child[i]; ++i){
            rtn = rtn.concat(child.GatherPieceAudioByAnnotId(annotid));
        }
        return rtn;
    };
    r2.Obj.prototype.HitTest = function(pt){
        var rtn = [];
        if(this._isvisible){
            for(var i = 0; i < this.child.length; ++i){
                rtn = rtn.concat(this.child[i].HitTest(pt));
            }
            if(this.pos.x < pt.x && this.pos.x+this.size.x > pt.x &&
                this.pos.y < pt.y && this.pos.y+this.size.y > pt.y && this._isvisible)
            {
                rtn.push(this);
            }
        }
        return rtn;
    };
    r2.Obj.prototype.GetPieceByHitTest = function(pt){
        var l = this.HitTest(pt);
        if(l.length > 0 && l[0].IsPiece) {
            return l[0];
        }
        else{
            return null;
        }
    };
    r2.Obj.prototype.GetPieceOfClosestBottom = function(pt, dy_obj){
        if (typeof dy_obj === 'undefined'){
            dy_obj = [Number.POSITIVE_INFINITY, null];
        }
        for(var i = 0; i < this.child.length; ++i){
            this.child[i].GetPieceOfClosestBottom(pt, dy_obj);
        }
        return dy_obj;
    };
    r2.Obj.prototype.RemoveAnnot = function(annotid){
        for(var i = 0; i < this.child.length; ++i){
            if(this.child[i].IsPiece){
                if(this.child[i]['GetAnnotId']){
                    if(this.child[i].GetAnnotId() == annotid){
                        this.child[i].Destructor();
                        this.child.splice(i--, 1);
                    }
                }
            }
        }
    };
    r2.Obj.prototype.GetNumPage = function(){
        return this._parent.GetNumPage();
    };
    r2.Obj.prototype.IsOnLeftColumn = function(){
        return this._parent.IsOnLeftColumn();
    };

    /*
     * Doc
     */
    r2.Doc = function(){
        this._pages = [];
    };
    r2.Doc.prototype.RunRecursive = function(func_name, args){
        var i, page;
        for(i = 0; page = this._pages[i]; ++i){
            page.RunRecursive(func_name, args);
        }
    };
    r2.Doc.prototype.AddPage = function(page){
        this._pages.push(page); // page has no parent
    };
    r2.Doc.prototype.GetPage = function(i){
        return this._pages[i];
    };
    r2.Doc.prototype.GetNumPages = function(){
        return this._pages.length;
    };
    r2.Doc.prototype.GetTargetPiece = function(target){
        if(target.type == "PieceKeyboard")
            return this._pages[target.page].SearchPiece(target.pid);
        return null;
    };
    r2.Doc.prototype.SearchPieceByAnnotId = function(annotid){
        var i, page;
        for(i = 0; page = this._pages[i]; ++i){
            var rtn = page.SearchPieceByAnnotId(annotid);
            if(rtn){return {page_n:i, piece:rtn};}
        }
        return null;
    };


    /*
     * Page
     */
    r2.Page = function() {
        r2.Obj.call(this);
    };
    r2.Page.prototype = Object.create(r2.Obj.prototype);

    r2.Page.prototype.SetPage = function(_num, size){
        this._num = _num;
        this.size = size;
        this._spotlight_cache = [];
    };
    r2.Page.prototype.GetNumPage = function(){
        return this._num;
    };
    r2.Page.prototype.GetRegion = function(i){
        return this.child[i];
    };
    r2.Page.prototype.Relayout = function(){
        var rt = this.child[0];
        var rl = this.child[1];
        var rr = this.child[2];
        var rb = this.child[3];

        var s_rt = rt.Relayout(new Vec2(0, 0));
        var s_rl = rl.Relayout(new Vec2(0, s_rt.y));
        var s_rr = rr.Relayout(new Vec2(s_rl.x, s_rt.y));
        var mx = Math.max(s_rt.x, s_rl.x+s_rr.x);
        var my = s_rt.y + Math.max(s_rl.y, s_rr.y);
        var s_rb = rb.Relayout(new Vec2(0, my));
        mx = Math.max(mx, s_rb.x);
        my = my + s_rb.y;

        this.size = new Vec2(mx, my);

        this.refreshSpotlightPrerender();
        this.refreshInkPrerender();

        r2App.invalidate_static_scene = true;
        r2App.invalidate_dynamic_scene = true;

        return this.size;
    };
    r2.Page.prototype.refreshSpotlightPrerender = function(){
        this._spotlight_cache = [];
        var i, spotlight, cache;
        for (var annotid in r2App.annots) {
            if (
                (r2App.annots.hasOwnProperty(annotid) && !r2App.annots[annotid].getIsBaseAnnot()) ||
                (r2App.cur_recording_annot !== null && annotid === r2App.cur_recording_annot.GetId())
            ){
                var annot = r2App.annots[annotid];
                var spotlights_of_page = annot.GetSpotlightsByNumPage(this._num);

                for(i = 0; spotlight = spotlights_of_page[i]; ++i){
                    var segments = spotlight.getValidSegments();
                    if(segments.length > 0){
                        var n_total_pts = segments.reduce(function(sum, item){return sum+item.GetNumPts();}, 0);
                        var t_step = (spotlight.t_end-spotlight.t_bgn)/n_total_pts;

                        var segment = segments[0];
                        var cache_tbgn = spotlight.t_bgn;
                        var cache_pid = segment.GetPieceId();
                        var cache_pts = segment.CopyPtsWithOffset(r2App.pieces_cache[segment.GetPieceId()].pos);

                        for(var j = 1; j < segments.length; ++j){
                            segment = segments[j];
                            if(!r2.Piece.prototype.isTheSameOrAdjecent(segment.GetPieceId(),cache_pid)){
                                cache = new r2.Spotlight.Cache();
                                var t_end_segment = cache_tbgn + cache_pts.length*t_step;
                                cache.setCache(
                                    annot,
                                    cache_tbgn,
                                    t_end_segment,
                                    cache_pts);
                                this._spotlight_cache.push(cache);
                                cache_pts = [];
                                cache_tbgn = t_end_segment;
                            }
                            cache_pid = segment.GetPieceId();
                            cache_pts = cache_pts.concat(segment.CopyPtsWithOffset(r2App.pieces_cache[segment.GetPieceId()].pos));
                        }
                        cache = new r2.Spotlight.Cache();
                        cache.setCache(
                            annot,
                            cache_tbgn,
                            spotlight.t_end,
                            cache_pts);
                        this._spotlight_cache.push(cache);
                    }
                }
            }
        }

        r2.spotlightRenderer.setCanvCtx(r2.viewCtrl.page_width_noscale, this.size.y/this.size.x);
        for(i = 0; spotlight = this._spotlight_cache[i]; ++i){
            spotlight.preRender(r2.spotlightRenderer.getCanvCtx(), r2.spotlightRenderer.getCanvWidth()); // ctx, ratio
        }
    };


    r2.Page.prototype.refreshInkPrerender = function(){
        r2.inkCtrl.dynamicScene.clear();

        this._Ink_cache = [];
        var i, Ink, cache;
        for (var annotid in r2App.annots) {
            if (r2App.annots.hasOwnProperty(annotid)){
                var annot = r2App.annots[annotid];
                var Inks_of_page = annot.GetInksByNumPage(this._num);

                for(i = 0; Ink = Inks_of_page[i]; ++i){
                    var segments = Ink.getValidSegments();
                    if(segments.length > 0){
                        var n_total_pts = segments.reduce(function(sum, item){return sum+item.GetNumPts();}, 0);

                        var t_step = (Ink.t_end-Ink.t_bgn)/n_total_pts;

                        var segment = segments[0];
                        var cache_tbgn = Ink._t_bgn;
                        var cache_pid = segment.GetPieceId();
                        var cache_pts = segment.CopyPtsWithOffset(r2App.pieces_cache[segment.GetPieceId()].pos);

                        for(var j = 1; j < segments.length; ++j){
                            segment = segments[j];
                            if(!r2.Piece.prototype.isTheSameOrAdjecent(segment.GetPieceId(),cache_pid)){
                                cache = new r2.Ink.Cache();
                                var t_end_segment = cache_tbgn + cache_pts.length*t_step;
                                cache.setCache(
                                    annot,
                                    cache_tbgn,
                                    t_end_segment,
                                    cache_pts);
                                this._Ink_cache.push(cache);
                                cache_pts = [];
                                cache_tbgn = t_end_segment;
                            }
                            cache_pid = segment.GetPieceId();
                            cache_pts = cache_pts.concat(segment.CopyPtsWithOffset(r2App.pieces_cache[segment.GetPieceId()].pos));
                        }
                        cache = new r2.Ink.Cache();
                        cache.setCache(
                            annot,
                            cache_tbgn,
                            Ink._t_end,
                            cache_pts);
                        this._Ink_cache.push(cache);
                    }
                }
            }
        }
        r2.InkRenderer.setCanvCtx(r2.viewCtrl.page_width_noscale, this.size.y/this.size.x);
        for(i = 0; Ink = this._Ink_cache[i]; ++i){
            Ink.preRender(r2.InkRenderer.getCanvCtx()); // ctx, ratio
        }
    };

    r2.Page.prototype.drawBackgroundWhite = function(){
        r2.canv_ctx.fillStyle = 'white';
        r2.canv_ctx.fillRect(0, 0, this.size.x, this.size.y);
    };
    r2.Page.prototype.drawSpotlightPrerendered = function(){
        r2.canv_ctx.drawImage(
            r2.spotlightRenderer.getCanv(),
            0, 0, 1.0, r2.spotlightRenderer.getRenderHeight(this.size.y, r2.viewCtrl.page_width_noscale)
        );
    };
    r2.Page.prototype.drawInkPrerendered = function(){
        var i, inks;
        for(i = 0; inks = this._Ink_cache[i]; ++i){
            inks.preRender(r2.canv_ctx);
        }
    };
    r2.Page.prototype.drawReplayBlob = function(canvas_ctx){
        var i, spotlight;
        for(i = 0; spotlight = this._spotlight_cache[i]; ++i){
            spotlight.drawReplayBlob(canvas_ctx);
        }
    };
    r2.Page.prototype.HitTest = function(pt){
        var rtn = r2.Obj.prototype.HitTest.apply(this, [pt]);
        var i, spotlight;
        for(i = 0; spotlight = this._spotlight_cache[i]; ++i){
            var v = spotlight.HitTest(pt);
            if(v){
                rtn.push(v);
            }
        }
        return rtn;
    };

    /*
     * Region
     */
    r2.Region = function() {
        r2.Obj.call(this);
    };
    r2.Region.prototype = Object.create(r2.Obj.prototype);

    r2.Region.prototype.GetRegionType = function(){
        var i, rgn;
        for(i = 0; rgn = this._parent.child[i]; ++i){
            if(rgn === this){
                return i;
            }
        }
        return -1;
    };

    r2.Region.prototype.Relayout = function(origin){
        origin = typeof origin !== 'undefined' ? origin : new Vec2(0, 0);
        this.pos = origin.clone();

        var mx = 0;
        var my = 0;
        var piece;
        for(var i = 0; piece = this.child[i]; ++i){
            var s = piece.Relayout();
            mx = Math.max(mx, s.x);
            my += s.y;
        }

        this.size = new Vec2(mx, my);
        return this.size;
    };
    r2.Region.prototype.DrawRect = function(){
        r2.Obj.prototype.DrawRect.apply(this, ['rgba(255,50,50,0.3)']);
        var p;
        for(var i = 0; p = this.child[i]; ++i) {
            p.DrawRect('rgba(50,255,50,0.3)');
        }
    };
    r2.Region.prototype.IsOnLeftColumn = function(){
        return this._parent.GetChild(1) === this;
    };


    /*
     * Piece
     */
    r2.Piece = function () {
        r2.Obj.call(this);

        this.IsPiece = true;
        this._id = null;
        this._creationTime = 0;
        this._cnt_size = new Vec2(0, 0); // contents size
        this._visible = true;
        this._ttDepth = 0;
        this._ttX = 0;
        this._ttW = 0;
        this._inks = {}; // [annoid][idx]
        this._isprivate = false;
        this._dom_piece = null;
    };
    r2.Piece.prototype = Object.create(r2.Obj.prototype);

    r2.Piece.prototype.Destructor = function(){
        delete r2App.pieces_cache[this._id];
    };
    r2.Piece.prototype.GetId = function(){
        return this._id;
    };
    r2.Piece.prototype.GetContentSize = function(){
        return this._cnt_size;
    };
    r2.Piece.prototype.GetCreationTime = function(){
        return this._creationTime;
    };
    r2.Piece.prototype.IsPrivate = function(){
        return this._isprivate;
    };

    r2.Piece.prototype.SetPiece = function(id, creationTime, cnt_size, tt_data){
        this._visible = true;
        this._id = id;
        this._creationTime = creationTime;
        this._cnt_size = cnt_size;
        this._ttDepth = tt_data[0];
        this._ttX = tt_data[1];
        this._ttW = tt_data[2];

        r2App.pieces_cache[this._id] = this;
    };
    r2.Piece.prototype.SetDom = function($dom_piece){
        this._dom_piece = $dom_piece.get(0);
    };
    r2.Piece.prototype.GetNewPieceSize = function(){
        return new Vec2(this._cnt_size.x, r2Const.PIECEAUDIO_HEIGHT);
    };
    r2.Piece.prototype.GetCurTtData = function(){
        return [this._ttDepth, this._ttX, this._ttW];
    };
    r2.Piece.prototype.GetTTData = function(){
        return [this._ttDepth+1, this._ttX, this._ttW];
    };
    r2.Piece.prototype.GetTtDepth = function(){
        return this._ttDepth;
    };
    r2.Piece.prototype.GetTtWidth = function(){
        return this._ttW;
    };
    r2.Piece.prototype.Relayout = function(){
        var dom_piece = this._dom_piece === null ? $(document.getElementById(this.GetId())).get(0) : this._dom_piece;
        if(this._dom_piece === null){
            console.log('x');
        }
        var rect = r2.dom.getPosAndWidthInPage(dom_piece);

        this.pos = new Vec2(rect[0], rect[1]);
        this.size = new Vec2(rect[2], rect[3]);

        var piece;
        for(var i = 0; piece = this.child[i]; ++i){
            piece.Relayout();
        }
        return  this.size;
    };
    r2.Piece.prototype.GetPieceOfClosestBottom = function(pt, dy_obj){
        if (typeof dy_obj === 'undefined'){
            dy_obj = [Number.POSITIVE_INFINITY, null];
        }
        var dy = Math.abs(this.pos.y + this._cnt_size.y - pt.y);
        if( (dy <= dy_obj[0]) &&
            ( this.pos.x < pt.x && pt.x < this.pos.x + this._cnt_size.x )){
            dy_obj[0] = dy;
            dy_obj[1] = this;
        }
        for(var i = 0; i < this.child.length; ++i){
            this.child[i].GetPieceOfClosestBottom(pt, dy_obj);
        }
        return dy_obj;
    };
    r2.Piece.prototype.SearchPiece = function(id){
        if (this._id == id)
            return this;
        var rtn = r2.Obj.prototype.SearchPiece.apply(this, [id]);
        if (rtn){
            return rtn;
        }
        return null;
    };
    r2.Piece.prototype.GetTtIndent = function(){
        var d;
        if(this._ttDepth == 0){
            d = 0;
        }
        else{
            d = this._ttDepth-1;
        }
        return this._ttX + d*r2Const.PIECE_TEXTTEARING_INDENT;
    };
    r2.Piece.prototype.GetTtIndentedWidth = function(){
        return this._ttX+this._ttW-this.GetTtIndent();
    };
    r2.Piece.prototype.addInk = function(annotid, stroke){
        if(!this._inks.hasOwnProperty(annotid)){
            this._inks[annotid] = [];
        }
        this._inks[annotid].push(stroke);
    };
    r2.Piece.prototype.getCollidingInks = function(pt, rtn){
        var ink;
        var pt_on_piece = pt.subtract(this.pos, true);
        var i, l;
        for (var key in this._inks) {
            if (this._inks.hasOwnProperty(key)) {
                for (i = 0, l = this._inks[key].length; i < l; ++i) {
                    ink = this._inks[key][i];
                    if(ink.getUsername() === r2.userGroup.cur_user.name){
                        if(ink.dist(pt_on_piece) <  r2Const.ERASER_RADIUS){
                            rtn.push(ink)
                        }
                    }
                }
            }
        }
    };
    r2.Piece.prototype.detachInk = function(ink){
        var inks = this._inks[ink._annotid];
            if(inks){
            var idx = inks.indexOf(ink);
            if(idx > -1) {
                inks.splice(idx, 1);
            }
        }
        else{
            throw new Error('detachInk:' + ink._annotid + JSON.stringify(ink));
        }
    };
    r2.Piece.prototype.getInkByTimeBgn = function(time, annotid){
        var inks = this._inks[annotid];
        if(typeof inks === 'undefined'){
            inks = this._inks[''];
        }
        if(inks){
            var i, l;
            for (i = 0, l = inks.length; i < l; ++i) {
                var t = inks[i].getTimeBgn();
                if(t === time){
                    return inks[i];
                }
            }
        }
        console.error('getInkByTimeBgn:', time, annotid);
        return null;
    };
    r2.Piece.prototype.drawInkReplaying = function(canvas_ctx){
        var ink;
        for (var key in this._inks) {
            if (this._inks.hasOwnProperty(key)) {
                for (var i = 0; ink = this._inks[key][i]; ++i) {
                    ink.drawReplaying(canvas_ctx);
                }
            }
        }
    };
    r2.Piece.prototype.GetSelectedColors = function(){
        var line_color; var glow_color;
        if(this._username && !this._isprivate){
            var user = r2.userGroup.GetUser(this._username);
            line_color = user.color_transparent_dark_html;
            glow_color = user.color_transparent_normal_html;
        }
        else{
            line_color = 'rgba(0, 0, 0, 0.5)';
            glow_color = 'rgba(75, 75, 75, 0.5)';
        }
        return [line_color, glow_color];
    };
    r2.Piece.prototype.DrawSelected = function(canvas_ctx, x_offset){
        x_offset = typeof x_offset === "undefined" ? 0.0 : x_offset;

        if(this._visible) {
            var colors = this.GetSelectedColors();
            var x_bgn = this.pos.x + this.GetTtIndent();
            var x0, x1, y;

            x0 = x_offset + x_bgn;
            x1 = x_offset + this.pos.x + this._ttX + this._ttW;
            y = this.pos.y + this._cnt_size.y;

            // line
            canvas_ctx.beginPath();
            canvas_ctx.moveTo(x0, y);
            canvas_ctx.lineTo(x1, y);

            canvas_ctx.shadowBlur = 0;
            canvas_ctx.shadowColor = colors[0];
            canvas_ctx.strokeStyle = colors[1];
            canvas_ctx.lineWidth = r2Const.PIECE_SELECTION_LINE_WIDTH;
            canvas_ctx.lineCap = 'butt';
            canvas_ctx.lineJoin = 'miter';
            canvas_ctx.stroke();
            canvas_ctx.shadowBlur = 0;

            // triangles

            var tri_w = 0.005;
            var tri_h_half = 0.0025;

            canvas_ctx.beginPath();
            canvas_ctx.fillStyle = colors[1];

            canvas_ctx.moveTo(x0, y);
            canvas_ctx.lineTo(x0-tri_w, y-tri_h_half);
            canvas_ctx.lineTo(x0-tri_w, y+tri_h_half);
            canvas_ctx.moveTo(x1, y);
            canvas_ctx.lineTo(x1+tri_w, y+tri_h_half);
            canvas_ctx.lineTo(x1+tri_w, y-tri_h_half);

            canvas_ctx.fill();
        }
    };
    /**
     * @returns {boolean}
     */
    r2.Piece.prototype.isTheSameOrAdjecent = function(pid0, pid1){
        if(pid0===pid1){
            return true;
        }
        else {
            var piece0 = r2App.pieces_cache[pid0];
            var piece1 = r2App.pieces_cache[pid1];

            return (
                Math.min(
                    Math.abs(piece0.pos.y+piece0.GetContentSize().y - piece1.pos.y),
                    Math.abs(piece1.pos.y+piece1.GetContentSize().y - piece0.pos.y)
                ) < 0.001
            );
        }
    };

    r2.Piece.prototype.RemoveAnnot = function(annotid){
        r2.Obj.prototype.RemoveAnnot.apply(this, [annotid]);
        if(this._inks.hasOwnProperty(annotid)){
            delete this._inks[annotid];
        }
    };


    /*
     * PieceText
     */
    r2.PieceText = function() {
        r2.Piece.call(this);
        this._t_src_x = 0;
        this._t_src_y = 0;
        this._t_src_w = 1;
        this._t_src_h = 1;
        this._t_dr_x = 0;
        this._t_dr_y = 0;
        this._t_dr_w = 1;
        this._t_dr_h = 1;
        this._t_pdf_w = 1;
    };
    r2.PieceText.prototype = Object.create(r2.Piece.prototype);

    r2.PieceText.prototype.GetAnchorTo = function(){
        // anchorTo: {type: 'PieceText', id: pid, page: 2} or
        var anchorCmd = {};
        anchorCmd.type = 'PieceText';
        anchorCmd.id = this.GetId();
        anchorCmd.page = this.GetNumPage();
        return anchorCmd;
    };
    r2.PieceText.prototype.SetPieceText = function(texCoordLT, texCoordRB, text){
        this._texCoordLT = texCoordLT;
        this._texCoordRB = texCoordRB;
        this._text = typeof text === 'string' ? text : '(empty)';
    };
    r2.PieceText.prototype.GetPieceText = function(){
        return this._text;
    };
    r2.PieceText.prototype.SetVisibility = function(visible){
        r2.Obj.prototype.SetVisibility.apply(this, [visible]);
        this._isvisible = true;
    };
    r2.PieceText.prototype.Relayout = function(){
        var rtn = r2.Piece.prototype.Relayout.apply(this, []);
        var pdf_x = Math.floor(this.pos.x * this._t_pdf_w);
        var pdf_y = Math.floor(this.pos.y * this._t_pdf_w);
        this._t_dr_x = pdf_x/this._t_pdf_w;
        this._t_dr_y = pdf_y/this._t_pdf_w;
        return rtn;
    };
    r2.PieceText.prototype.SetPdf = function(canvas_size){
        this._t_pdf_w = canvas_size.x;

        this._t_src_x = Math.floor(this._texCoordLT.x * canvas_size.x);
        this._t_src_y = Math.floor((1.0-this._texCoordLT.y) * canvas_size.y);
        this._t_src_w = Math.floor((this._cnt_size.x) * this._t_pdf_w);
        this._t_src_h = Math.floor((this._cnt_size.y) * this._t_pdf_w + 1);

        this._t_dr_x = Math.floor(this.pos.x * this._t_pdf_w)/this._t_pdf_w;
        this._t_dr_y = Math.floor(this.pos.y * this._t_pdf_w)/this._t_pdf_w;
        this._t_dr_w = this._t_src_w/this._t_pdf_w;
        this._t_dr_h = this._t_src_h/this._t_pdf_w;
    };

    r2.PieceText.prototype.DrawPiece = function(){
        var canv = r2.pdfRenderer.getCanvas(this.GetNumPage());
        if(canv){
            r2.canv_ctx.drawImage(canv,
                this._t_src_x, this._t_src_y, this._t_src_w, this._t_src_h,
                this._t_dr_x, this._t_dr_y, this._t_dr_w, this._t_dr_h);
        }
    };


    /*
     * PieceTeared
     */
    r2.PieceTeared = function() {
        r2.Piece.call(this);
        this._username = null;
    };
    r2.PieceTeared.prototype = Object.create(r2.Piece.prototype);

    r2.PieceTeared.prototype.ExportToCmd = function(){
        // time: 2014-12-21T13...
        // user: 'red user'
        // op: 'CreateComment'
        // type: 'TextTearing'
        // anchorTo: ...
        // data: {pid: id, height: 0.1}
        var cmd = {};
        cmd.time = (new Date(this._creationTime)).toISOString();
        cmd.user = this._username;
        cmd.op = "CreateComment";
        cmd.type = "TextTearing";
        cmd.anchorTo = this._parent.GetAnchorTo();
        cmd.data = {};
        cmd.data.pid = this._id;
        cmd.data.height = this._cnt_size.y;
        return cmd;
    };
    r2.PieceTeared.prototype.getUsername = function(){
        return this._username;
    };
    r2.PieceTeared.prototype.GetAnchorTo = function(){
        //           {type: 'PieceTeared', id: pid, page: 2}
        var anchorCmd = {};
        anchorCmd.type = 'PieceTeared';
        anchorCmd.id = this.GetId();
        anchorCmd.page = this.GetNumPage();
        return anchorCmd;
    };
    r2.PieceTeared.prototype.resize = function(new_height){
        this._cnt_size.y = new_height;
    };
    r2.PieceTeared.prototype.SetPieceTeared = function(username){
        this._username = username;
    };
    r2.PieceTeared.prototype.DrawPiece = function(){
        var x_bgn = this.pos.x + this.GetTtIndent();

        r2.canv_ctx.setLineDash([r2Const.PIECE_LINE_DASH*0.75, r2Const.PIECE_LINE_DASH*0.25]);
        r2.canv_ctx.beginPath();
        r2.canv_ctx.moveTo(x_bgn, this.pos.y);
        r2.canv_ctx.lineTo(x_bgn + this._ttW, this.pos.y);
        r2.canv_ctx.strokeStyle = r2.userGroup.GetUser(this._username).color_normal_html;
        r2.canv_ctx.lineWidth = r2Const.PIECE_LINE_WIDTH;
        r2.canv_ctx.lineCap = 'butt';
        r2.canv_ctx.lineJoin = 'miter';
        r2.canv_ctx.stroke();
        r2.canv_ctx.setLineDash([]);

        if(this._visible) {
            r2.canv_ctx.beginPath();
            r2.canv_ctx.moveTo(x_bgn, this.pos.y);
            r2.canv_ctx.lineTo(x_bgn, this.pos.y+this._cnt_size.y);
            r2.canv_ctx.strokeStyle = r2.userGroup.GetUser(this._username).color_normal_html;
            r2.canv_ctx.lineWidth = r2Const.PIECE_LINE_WIDTH;
            r2.canv_ctx.lineCap = 'butt';
            r2.canv_ctx.lineJoin = 'miter';
            r2.canv_ctx.stroke();
        }
    };


    /*
     * PieceAudio
     */
    r2.PieceAudio = function() {
        r2.Piece.call(this);
        this._annotid = null;
        this._username = null;
        this._t_bgn = 0;
        this._t_end = 0;
        this._audio_dbs = [];
        this._audio_dbs_recording = [];

        this.__annot = null;
    };
    r2.PieceAudio.prototype = Object.create(r2.Piece.prototype);

    r2.PieceAudio.prototype.GetAnchorTo = function(){
        //           {type: 'CommentAudio', id: annotId, page: 2, time: [t0, t1]}
        var anchorCmd = {};
        anchorCmd.type = 'CommentAudio';
        anchorCmd.id = this._annotid;
        anchorCmd.page = this.GetNumPage();
        anchorCmd.time = [this._t_bgn, this._t_end];
        return anchorCmd;
    };
    r2.PieceAudio.prototype.Destructor = function(){
        r2.Piece.prototype.Destructor.apply(this);
    };
    r2.PieceAudio.prototype.GetAnnot = function(){
        if(this.__annot==null){
            this.__annot = r2App.annots[this._annotid];
        }
        return this.__annot;
    };
    r2.PieceAudio.prototype.GetAnnotId = function(){
        if(this._annotid != null){
            return this._annotid;
        }
    };
    r2.PieceAudio.prototype.SearchPieceByAnnotId = function(annotid){
        var result = r2.Obj.prototype.SearchPieceByAnnotId.apply(this, [annotid]);
        if(result){
            return result;
        }
        else{
            if(this._annotid == annotid){ // ToDo check it returns the first piece
                return this;
            }
            else{
                return null;
            }
        }
    };
    r2.PieceAudio.prototype.SearchPieceAudioByAnnotId = function(annotid, time){
        var rtn = r2.Obj.prototype.SearchPieceAudioByAnnotId.apply(this, [annotid, time]);
        if(rtn != null){
            return rtn;
        }
        else{
            if(this._annotid == annotid && time < this._t_end){
                return this;
            }
            else{
                return null;
            }
        }
    };
    r2.PieceAudio.prototype.GatherPieceAudioByAnnotId = function(annotid){
        var rtn = r2.Obj.prototype.GatherPieceAudioByAnnotId.apply(this, [annotid]);
        if(this._annotid == annotid){
            rtn = rtn.concat([this]);
        }
        return rtn;
    };
    r2.PieceAudio.prototype.GetTimeBgn = function(){
        return this._t_bgn;
    };
    r2.PieceAudio.prototype.GetTimeEnd = function(){
        return this._t_end;
    };
    r2.PieceAudio.prototype.SetPieceAudio = function(annotid, username, t_bgn, t_end){
        this._annotid = annotid;
        this._username = username;
        this._t_bgn = t_bgn;
        this._t_end = t_end;

        var w = (this._t_end-this._t_bgn)/r2Const.PIECEAUDIO_TIME_PER_WIDTH;
        var n = Math.floor(w/r2Const.PIECEAUDIO_STEP_W);

        this._audio_dbs = [];
        for(var i = 0; i < n+1; ++i){
            var v = 0.9*this.GetAnnot().SampleAudioDbs(this._t_bgn+i*r2Const.PIECEAUDIO_STEP_T);
            if(v>0){
                this._audio_dbs.push(v);
            }
            else{
                this._audio_dbs.push(0);
            }
        }
    };
    r2.PieceAudio.prototype.UpdateAudioDbsRecording = function(t_end){
        this._t_end = t_end;

        var w = (this._t_end-this._t_bgn)/r2Const.PIECEAUDIO_TIME_PER_WIDTH;
        var n = Math.floor(w/r2Const.PIECEAUDIO_STEP_W);

        for(var i = this._audio_dbs_recording.length; i < n+1; ++i){
            var v = Math.max(0, 0.9*this.GetAnnot().SampleAudioDbs(this._t_bgn+i*r2Const.PIECEAUDIO_STEP_T));
            if(v>0){
                this._audio_dbs_recording.push(v);
            }
            else{
                this._audio_dbs_recording.push(0);
            }
        }
    };
    r2.PieceAudio.prototype.Relayout = function(){
        var rtn = r2.Piece.prototype.Relayout.apply(this, []);
        return rtn;
    };
    r2.PieceAudio.prototype.DrawPiece = function(){
        var x_bgn = this.pos.x + this.GetTtIndent();
        var y_bgn = this.pos.y-r2Const.PIECEAUDIO_LINE_WIDTH;

        if(this._isvisible){
            r2.canv_ctx.beginPath();
            var x = x_bgn;
            var y = y_bgn+this._cnt_size.y;
            r2.canv_ctx.moveTo(x, y);
            for(var i = 0; i < this._audio_dbs.length; ++i){
                x = x_bgn+i*r2Const.PIECEAUDIO_STEP_W;
                y = y_bgn+this._cnt_size.y*(1.0-this._audio_dbs[i]);
                r2.canv_ctx.lineTo(x, y);
            }
            y = y_bgn+this._cnt_size.y;
            r2.canv_ctx.lineTo(x, y);
            r2.canv_ctx.fillStyle = this.GetAnnot().GetUser().color_light_html;
            r2.canv_ctx.closePath();
            r2.canv_ctx.fill();
        }

        var cnt_size_y = this._cnt_size.y;
        if(!this._isvisible){
            cnt_size_y = 0
        }
        r2.canv_ctx.beginPath();


        r2.canv_ctx.moveTo(x_bgn, y_bgn+cnt_size_y);
        r2.canv_ctx.lineTo(x_bgn+this.GetTtIndentedWidth(), y_bgn+cnt_size_y);


        r2.canv_ctx.strokeStyle = this.GetAnnot().GetUser().color_light_html;
        r2.canv_ctx.lineWidth = r2Const.PIECEAUDIO_LINE_WIDTH;
        r2.canv_ctx.lineCap = 'round';
        r2.canv_ctx.lineJoin = 'round';
        r2.canv_ctx.stroke();


        if(this._t_bgn === 0) {
            var pieceaudios = this.GetParent().GatherPieceAudioByAnnotId(this._annotid);
            var lastpiece = pieceaudios[pieceaudios.length-1];
            var last_y = lastpiece.pos.y+lastpiece.GetContentSize().y-r2Const.PIECEAUDIO_LINE_WIDTH;
            var ratio = Math.pow(0.8, this.GetTtDepth() - 1);
            var x_tip = this.pos.x + this.GetTtIndent() - (r2Const.RADIALMENU_OFFSET_X - r2Const.RADIALMENU_RADIUS) * ratio;
            r2.canv_ctx.beginPath();
            r2.canv_ctx.moveTo(x_bgn, last_y);
            r2.canv_ctx.lineTo(x_bgn, y - cnt_size_y);
            r2.canv_ctx.lineTo(x_tip, y - cnt_size_y);
            r2.canv_ctx.fillStyle = this.GetAnnot().GetUser().color_audiopiece_guideline_html;
            r2.canv_ctx.closePath();
            r2.canv_ctx.fill();

            r2.canv_ctx.beginPath();
            r2.canv_ctx.moveTo(x_bgn, y_bgn);
            r2.canv_ctx.lineTo(x_bgn, last_y);
            r2.canv_ctx.strokeStyle = this.GetAnnot().GetUser().color_light_html;
            r2.canv_ctx.lineWidth = r2Const.PIECEAUDIO_LINE_WIDTH;
            r2.canv_ctx.lineCap = 'round';
            r2.canv_ctx.lineJoin = 'round';
            r2.canv_ctx.stroke();
        }
    };
    r2.PieceAudio.prototype.DrawPieceDynamic = function(cur_annot_id, canvas_ctx, force){
        var n;
        if(force){
            n = this._audio_dbs.length;
        }
        else{
            if(this._annotid != cur_annot_id){return;}
            n = Math.min((r2App.cur_audio_time-this._t_bgn)/r2Const.PIECEAUDIO_STEP_T, this._audio_dbs.length);
        }

        var x_bgn = this.pos.x + this.GetTtIndent();
        var y_bgn = this.pos.y-r2Const.PIECEAUDIO_LINE_WIDTH;

        canvas_ctx.beginPath();
        var x = x_bgn;
        var y = y_bgn+this._cnt_size.y;
        canvas_ctx.moveTo(x, y);
        for(var i = 0; i < n; ++i){
            x = x_bgn+i*r2Const.PIECEAUDIO_STEP_W;
            y = y_bgn+this._cnt_size.y*(1.0-this._audio_dbs[i]);
            canvas_ctx.lineTo(x, y);
        }
        y = y_bgn+this._cnt_size.y;
        canvas_ctx.lineTo(x, y);
        canvas_ctx.fillStyle = this.GetAnnot().GetUser().color_normal_html;
        canvas_ctx.closePath();
        canvas_ctx.fill();
    };
    r2.PieceAudio.prototype.GetPlayback = function(pt){
        var rtn = {};

        var dx = pt.x - this.pos.x - this.GetTtIndent();
        var t = this._t_bgn+r2Const.PIECEAUDIO_TIME_PER_WIDTH*dx;
        if( t > this._t_bgn && t < this._t_end){
            rtn.annot = this._annotid;
            rtn.t = t;
            return rtn;
        }
        else{
            return null;
        }
    };
    r2.PieceAudio.prototype.IsAnnotHasComment = function(annotid, rtn){
        if(this._annotid == annotid){
            rtn.push(this.child.length != 0);
        }
    };
    r2.PieceAudio.prototype.FillUpAudioDbs = function(){
        for(var i = this._audio_dbs.length; i < this._audio_dbs_recording.length; ++i) {
            r2App.cur_recording_minmax[0] = Math.min(this._audio_dbs_recording[i], r2App.cur_recording_minmax[0]);
            r2App.cur_recording_minmax[1] = Math.max(this._audio_dbs_recording[i], r2App.cur_recording_minmax[1]);
            var v = 0.9*(this._audio_dbs_recording[i]-r2App.cur_recording_minmax[0])/(r2App.cur_recording_minmax[1]-r2App.cur_recording_minmax[0]);
            this._audio_dbs.push(v);
        }
    };
    r2.PieceAudio.prototype.RefreshAudioDbs = function(){
        this._audio_dbs = [];
        for(var i = 0; i < this._audio_dbs_recording.length; ++i) {
            r2App.cur_recording_minmax[0] = Math.min(this._audio_dbs_recording[i], r2App.cur_recording_minmax[0]);
            r2App.cur_recording_minmax[1] = Math.max(this._audio_dbs_recording[i], r2App.cur_recording_minmax[1]);
            var v = 0.9*(this._audio_dbs_recording[i]-r2App.cur_recording_minmax[0])/(r2App.cur_recording_minmax[1]-r2App.cur_recording_minmax[0]);
            this._audio_dbs.push(v);
        }
    };
    r2.PieceAudio.prototype.NormalizePieceAudio = function(l, refresh_all){
        if(!refresh_all){
            var i, pa;
            for(i = 0; pa = l[i]; ++i){
                pa.FillUpAudioDbs();
            }
        }
        else{
            var i, pa;
            for(i = 0; pa = l[i]; ++i){
                pa.RefreshAudioDbs();
            }
        }
    };


    /*
     * PieceNewSpeak
     */
    r2.PieceNewSpeak = function(){
        r2.Piece.call(this);
        this._annotid = null;
        this._username = null;

        this.dom = null;
        this.dom_textbox = null;
        this._temporary_n = 0;
        this.annotids = [];
    };
    r2.PieceNewSpeak.prototype = Object.create(r2.Piece.prototype);
    r2.PieceNewSpeak.prototype.Destructor = function(){
        r2.Piece.prototype.Destructor.apply(this);
    };
    r2.PieceNewSpeak.prototype.AbortPendingAudioDownload = function() {
        if (this._cbAbortTTSDownload) {
            console.warn('Aborted download of TTS audio.');
            this._cbAbortTTSDownload();
            this._cbAbortTTSDownload = null;
        }
    };
    r2.PieceNewSpeak.prototype.SetPieceNewSpeak = function(anchor_pid, annotid, username, inner_html, live_recording){
        this._annotid = annotid;
        this._username = username;
        this.RENDER_AUDIO_IMMEDIATELY = true;
        this.LIVE_CAPTIONING = false;

        var dom = this.CreateDom();

        r2.localLog.pieceCreated('newspeak', annotid, anchor_pid);

        r2.dom_model.appendPieceEditableAudio(
            this._username,
            this._annotid,
            this.GetId(),
            anchor_pid,
            this._creationTime,
            dom,
            this,
            live_recording,
            this.AbortPendingAudioDownload.bind(this)
        );

        this.setInnerHtml(inner_html);

        return dom;
    };
    r2.PieceNewSpeak.prototype.GetAnnotId = function(){
        if(this._annotid != null){
            return this._annotid;
        }
    };
    r2.PieceNewSpeak.prototype.CreateDom = function(){
        this.dom = document.createElement('div');
        this.dom.classList.toggle('r2_piece_editable_audio', true);
        this.dom.classList.toggle('unselectable', true);
        this.dom.setAttribute('aria-label', 'text comment');
        this.dom.setAttribute('role', 'article');

        this.dom_tr = document.createElement('div');
        this.dom_tr.classList.toggle('r2_piece_editable_audio_tr', true);
        this.dom_tr.classList.toggle('unselectable', true);
        this.dom.appendChild(this.dom_tr);

        this.dom_textbox = document.createElement('div');
        this.dom_textbox.setAttribute('contenteditable', 'true');
        this.dom_textbox.classList.toggle('r2_piece_newspeak', true);
        this.dom_textbox.classList.toggle('text_selectable', true);
        this.dom_textbox.style.color = r2.userGroup.GetUser(this._username).color_piecekeyboard_text;
        this.dom_tr.appendChild(this.dom_textbox);

        $(this.dom_tr).css('left', this.GetTtIndent()*r2Const.FONT_SIZE_SCALE+'em');
        $(this.dom_tr).css('width', this.GetTtIndentedWidth()*r2Const.FONT_SIZE_SCALE+'em');

        if(this._username != r2.userGroup.cur_user.name){
            this.dom_textbox.setAttribute('contenteditable', 'false');
        }

        // Create edit controller
        this.speak_ctrl = new r2.speak.controller();

        /* add event handlers*/
        var func_UpdateSizeWithTextInput = this.updateSizeWithTextInput.bind(this);

        // Debug
        var annotId = this._annotid;
        var _tb = $(this.dom_textbox);
        var _last_tts_talkens = this._last_tts_talkens;
        function getSelectionJSON() {
            var sel = r2.speak.saveSelection(_tb[0]);
            var range = [sel.start, sel.end];
            return {'selectionText':(sel.start === sel.end ? '' : _tb.text().substring(sel.start, sel.end)), 'selectionRange':range};
        }
        var getCursorTTSTalkenOffset = function() {
            var sel = r2.speak.saveSelection(_tb[0]);
            if (!this._last_tts_talkens) return 0;

            var tks = [];
            for (var k = 0; k < this._last_tts_talkens.length; k++) {
                if (this._last_tts_talkens[k].word.indexOf('♦') === -1)
                    tks.push(this._last_tts_talkens[k]);
            }

            var stripped_txt = _tb.text().trim().replace(/\♦/g, '');
            var words = stripped_txt.split(/\s+/g);
            var sel_word_idx = _tb.text().substring(0, sel.start).trim().replace(/\♦/g, '').split(/\s+/g).length - 1;
            if (sel_word_idx >= words.length) sel_word_idx = words.length-1;
            else if (sel_word_idx < 0) sel_word_idx = 0;

            if (this._last_sel_word_idx && sel_word_idx === this._last_sel_word_idx) return this._last_tts_talken_offset;
            var scope_range = 0; // the number of words to consider around the selected word

            // Non-local version.
            // 1. Finds the closest word to the cursor position.
            // 2. Splits the text by whitespace.
            // 3. Finds all instances of the selected word in the previous tts talken rendering.
            // 4. Gradually narrows the possibilities by widening the search scope one talken at a time.
            // 5. Finds the unique matching (if possible) and rectifies its position.

            function matches(a, b, replaceFunc) {
                if (a.length !== b.length) return false;
                if (typeof replaceFunc !== 'undefined') {
                    a.map(function(e) { return replaceFunc(e); });
                    b.map(function(e) { return replaceFunc(e); });
                }
                for(var i = 0; i < a.length; i++) {
                    if (a[i] !== b[i]) return false;
                }
                return true;
            }

            function scoped_words(idx, range) {
                if (range === 0) return [words[idx]];
                return words.slice(Math.max(idx - range, 0), Math.min(idx + range + 1, words.length));
            }
            function scoped_tks(idx, range) {
                if (range === 0) return [tks[idx]];
                return tks.slice(Math.max(idx - range, 0), Math.min(idx + range + 1, tks.length));
            }

            var candidate_tks_idxs = Array.apply(null, {length: tks.length}).map(Number.call, Number); // range from [0... tks.length]
            var next_candidate_tks_idxs = [];
            var n = 10;

            console.log(' -- finding match from center word ', words[sel_word_idx]);

            while (n > 0 && candidate_tks_idxs.length > 1) { // While there are alternative candidates... (or cutoff after 10 iterations)

                var x = 0;
                var sws = scoped_words(sel_word_idx, scope_range);
                console.log(' -- finding match with scoped words ', sws);
                for (; x < candidate_tks_idxs.length; x++) { // bread-first expansion is quicker
                    var j = candidate_tks_idxs[x];

                    if (matches(sws, scoped_tks(j, scope_range).map(function(elem) { return elem.word; }))) { // expand search radius
                        next_candidate_tks_idxs.push(j);
                    }
                }

                candidate_tks_idxs = next_candidate_tks_idxs;
                next_candidate_tks_idxs = [];
                scope_range++;
                n--;

                console.log(' -- FOUND candidates ', candidate_tks_idxs);
            }

            var oset = candidate_tks_idxs.length === 1 ? candidate_tks_idxs[0] : -1; // unique or nothing; don't try to guess the playhead if unsure
            this._last_sel_word_idx = sel_word_idx;
            this._last_tts_talken_offset = oset; // this is for speed. We don't want to have to search everytime the user presses the arrow key.
            return oset;
        }.bind(this);

        var highlightGestureAtCursorPos = function() {
            if (!this._last_tts_talkens || r2App.mode !== r2App.AppModeEnum.IDLE) return;
            var idx = getCursorTTSTalkenOffset();
            if (idx > -1 && idx < this._last_tts_talkens.length) {
                var playhead_pos = (this._last_tts_talkens[idx].new_bgn + this._last_tts_talkens[idx].new_end) / 2.0;
                console.log('Playhead set to ', playhead_pos, ' from offset ', idx);
                r2.rich_audio.jump(annotId, playhead_pos);
                r2App.invalidate_dynamic_scene = true;
            }
        }.bind(this);

        var isArrowKey = function(code) {
            return (code === r2.keyboard.CONST.KEY_LEFT || code === r2.keyboard.CONST.KEY_RGHT ||
                code === r2.keyboard.CONST.KEY_DN || code === r2.keyboard.CONST.KEY_UP);
        };

        this.dom_textbox.addEventListener('keydown', function(e) {
            //if (e.keyCode === 13) {
            //    this.SetAnonAudioRenderType(( this.anonAudioRenderType === 'anon' ? 'patch' : 'anon' ));
            //    e.preventDefault();
            //}

            r2.localLog.event('keydown', annotId, {'key':e.keyCode, 'text':_tb.text(), 'selection':getSelectionJSON()});

            if (e.keyCode === r2.keyboard.CONST.KEY_ENTER) {
                // Insert voice recording
                if (r2App.mode === r2App.AppModeEnum.RECORDING || this.recording_mode === true) {

                }
                else{
                    if (r2App.mode === r2App.AppModeEnum.REPLAYING) {
                        r2.localLog.event('cmd-audio-force-stop', annotId, {'input': 'key-enter'});
                        r2.rich_audio.stop();
                    }

                     // INSERT RECORDING
                    r2.localLog.event('cmd-audio-insert', annotId, {'input': 'key-enter'});
                    r2.recordingCtrl.set(
                        this._parent,
                        { // option
                            ui_type: r2App.RecordingUI.SIMPLE_SPEECH,
                            caption_major: true,
                            piece_to_insert: this
                        }
                    );
                }
                e.preventDefault();
            }
            else if (this.isWaitingForWatson()) {
                e.preventDefault();
            }
            else if (r2App.mode === r2App.AppModeEnum.RECORDING) {
                r2.recordingCtrl.stop(); // stop recording if any key other is hit while recording
                e.preventDefault();
            } else {
                if (r2.keyboard.modifier_key_dn) {
                    if (e.keyCode === r2.keyboard.CONST.KEY_C)
                        r2.localLog.event('copy', annotId, {'text':_tb.text(), 'selection':getSelectionJSON()});
                    else if (e.keyCode === r2.keyboard.CONST.KEY_X)
                        r2.localLog.event('cut', annotId, {'text':_tb.text(), 'selection':getSelectionJSON()});
                    else if (e.keyCode === r2.keyboard.CONST.KEY_V)
                        r2.localLog.event('paste', annotId, {'text':_tb.text(), 'selection':getSelectionJSON()});
                } else {

                    // Highlight gesture at cursor position.
                    if(isArrowKey(e.keyCode)) // move the playhead
                        highlightGestureAtCursorPos();
                }
            }

        }.bind(this));

        this.dom_textbox.addEventListener('keyup', function(e) {
            r2.localLog.event('keyup', annotId, {'key':e.keyCode, 'text':_tb.text(), 'selection':getSelectionJSON()});

            // Highlight gesture at cursor position.
            if(isArrowKey(e.keyCode)) // move the playhead
                highlightGestureAtCursorPos();

        }.bind(this));

        this.dom_textbox.addEventListener('selectstart', function(e) {
            r2.localLog.event('selectstart', annotId, getSelectionJSON());
        });
        this.dom_textbox.addEventListener('mousedown', function(e) {
            r2.localLog.event('mousedown', annotId, getSelectionJSON());
        });
        this.dom_textbox.addEventListener('mouseup', function(e) {
            r2.localLog.event('mouseup', annotId, getSelectionJSON());

            // Highlight gesture at cursor position.
            highlightGestureAtCursorPos();

        }.bind(this));

        this.dom_textbox.addEventListener('input', function() {
            this.__contentschanged = true;
            if(func_UpdateSizeWithTextInput()){
                r2App.invalidate_size = true;
                r2App.invalidate_page_layout = true;
            }
        }.bind(this), false);

        this.dom_textbox.addEventListener('focus', function(event){
            r2App.cur_focused_piece_keyboard = this;
            var color = r2.userGroup.GetUser(this._username).color_piecekeyboard_box_shadow;
            this.dom_textbox.style.boxShadow = "0 0 0.2em "+color+" inset, 0 0 0.2em "+color;
            $(this.dom).css("pointer-events", 'auto');
            $(this.dom_textbox).toggleClass('editing', true);

            // Restore cursor position from blur
            if (this.blur_caret)
                r2.speak.restoreSelection(this.dom_textbox, this.blur_caret);

            r2.localLog.event('focus', annotId, {'text':_tb.text()});
        }.bind(this));
        r2.keyboard.pieceEventListener.setTextbox(this.dom_textbox);

        this.dom_textbox.addEventListener('blur', function(event){
            // save cursor pos
            this.blur_caret = r2.speak.saveSelection(this.dom_textbox);

            // remove cursor complete from the textbox,
            // otherwise it will interfere with mouse interaction for other visaul entities
            window.getSelection().removeAllRanges();

            r2App.cur_focused_piece_keyboard = null;
            this.dom_textbox.style.boxShadow = "none";

            if (r2App.mode !== r2App.AppModeEnum.RECORDING) {
                this.updateSpeakCtrl();
                this.renderAudio();
            }

            //$(this.dom).css("pointer-events", 'none');
            $(this.dom_textbox).toggleClass('editing', false);
            if(this.__contentschanged){
                //console.log('>>>>__contentschanged:', this.ExportToTextChange());
                //r2Sync.PushToUploadCmd(this.ExportToTextChange());
                this.__contentschanged = false;
            }

            r2.localLog.event('blur', annotId, {'text':_tb.text()});
        }.bind(this));

        /* add event handlers*/

        this.resizeDom();

        return this.dom;
    };
    r2.PieceNewSpeak.prototype.updateSpeakCtrl = function() {

        // Update audio model w/ new edits (if any)
        this.speak_ctrl.update($(this.dom_textbox).text());

        // Resynthesize annot gestures
        // var annotid = this._annotid;
        // var tks = this.speak_ctrl.getCompiledTalkens().map(function(tk) {
        //     return [tk.audio ? annotid : null, tk.bgn, tk.end];
        // }); // NOTE: This assumes all talkens have the same audio.
        // r2.annotSynthesizer.run([annotid], tks);
    };
    r2.PieceNewSpeak.prototype.isWaitingForWatson = function() {
        return this._waiting_for_watson;
    };
    r2.PieceNewSpeak.prototype.renderAndPlay = function() {

        var annot_id = this.GetAnnotId();
        r2.localLog.event('ctrl-play', annot_id, {'text':$(this.dom_textbox).text()});

        r2.radialMenu.bgnLoading('rm_' + r2.util.escapeDomId(annot_id)); // show the 'compiling' sign
        this.afterAudioRender = function(audio_url) {
            var annot_id = this.GetAnnotId();
            r2.radialMenu.endLoading('rm_' + r2.util.escapeDomId(annot_id));
            r2.rich_audio.play(
                annot_id,
                -1,
                function() {
                    r2.radialMenu.bgnLoading('rm_' + r2.util.escapeDomId(annot_id));
                },
                function() {
                    r2.radialMenu.endLoading('rm_' + r2.util.escapeDomId(annot_id));
                }
            );
        }.bind(this);


        if (!this.speak_ctrl.needsRender() && !this._is_rendering) this.afterAudioRender();
        else if (!this._is_rendering) this.renderAudio();
    };
    r2.PieceNewSpeak.prototype.renderAudio = function() {
        if (this.speak_ctrl.needsRender()) {

            // We need to get this immediately b/c they might changed WHILE the call below is processing!
            // (at which point the correspondance between TTS audio transcript and textbox transcript may not be exact.)
            //this._last_tts_talkens = null;
            //var edited_talkens = this.speak_ctrl.getCompiledTalkens();
            this._is_rendering = true;

            return this.speak_ctrl.renderTTSAudioPatchy(this.GetAnnotId(), '').then(function(eandt) {
                console.log(' @ patchSynth @ doc_model: ', eandt);

                if (typeof eandt === 'undefined') {
                    console.error('Error @ patchSynth @ doc_model: response is undefined.');
                    return new Promise(function(resolve, reject) {
                        resolve(undefined);
                    });
                }

                var edited_talkens = eandt[0];
                var tts_talkens = eandt[1];
                var annotId = this.GetAnnotId();

                if (tts_talkens.length > 0) { // Set annot audio to finalized version
                    r2App.annots[annotId].SetRecordingAudioFileUrl(tts_talkens[0].audio.url, null);
                    this._last_tts_audio_url = tts_talkens[0].audio.url;
                }
                else this._last_tts_audio_url = null;

                // Handle common errors
                if (!tts_talkens || tts_talkens.length === 0) {
                    console.error("Error @ r2.PieceNewSpeak.renderAudio: HTK returned no talkens.");
                    return;
                }
                else if (!edited_talkens || edited_talkens.length === 0) {
                    console.error("Error @ r2.PieceNewSpeak.renderAudio: HTK returned talkens, but we're not sure where the edited talkens went!");
                    return;
                }
                else if (edited_talkens.length !== tts_talkens.length) {
                    console.warn("Warning @ r2.PieceNewSpeak.renderAudio: Length of HTK talkens != length of original talkens.");
                    if (tts_talkens.length > edited_talkens.length) {
                        console.error("Error @ r2.PieceNewSpeak.renderAudio: # of tts talkens EXCEEDS # of edited talkens.");
                        return; // If # of tts talkens < edited, then continue, since it's better than doing nothing.
                    }
                }

                // Convert to format of talkens expected by r2.gestureSynthesizer
                var gesynth_tks = [];
                for (var i = 0; i < tts_talkens.length; i++) {
                    var tts_tk = tts_talkens[i];
                    var src_tk = edited_talkens[i];
                    gesynth_tks.push({
                       base_annotid: (src_tk.audio && src_tk.audio.annotId && (tts_tk.bgn !== tts_tk.end) ? src_tk.audio.annotId : null),
                       base_bgn: src_tk.bgn,
                       base_end: src_tk.end,
                       new_bgn: tts_tk.bgn,
                       new_end: tts_tk.end,
                       word: src_tk.word,
                       pause_after: tts_tk.pauseAfter,
                       pause_before: tts_tk.pauseBefore
                    });
                }
                this._last_tts_talkens = gesynth_tks;

                // Resynthesize gestures for this annotation for new TTS audio...
                r2.localLog.event('synth-gesture', annotId, {'talkensToSynth':gesynth_tks});
                console.warn('gesynth ----> ', gesynth_tks);
                r2.gestureSynthesizer.run(annotId, gesynth_tks);

                this._is_rendering = false;
                if (this.afterAudioRender) {
                    this.afterAudioRender(this._last_tts_audio_url);
                    this.afterAudioRender = null;
                }

                return new Promise(function(resolve, reject) {
                    resolve(this._last_tts_audio_url);
                }.bind(this));

            }.bind(this));

            // this.speak_ctrl.renderAudioAnon(this.GetAnnotId(), '').then((function(finalAudioURL) {
            //
            //     if (!finalAudioURL) {
            //         console.warn('Error processing audio. Check console for details.');
            //         return;
            //     }
            //
            //     var annotId = this.GetAnnotId();
            //     r2.localLog.event('rendered-audio', annotId, {'url':finalAudioURL});
            //     r2.localLog.editedBlobURL(finalAudioURL, annotId);
            //     r2App.annots[annotId].SetRecordingAudioFileUrl(finalAudioURL, null); // Set annot audio to finalized version
            //
            //     // Get timestamps for TTS audio with HTK
            //     this.speak_ctrl.generateTalkensFromHTK(finalAudioURL).then((function(tts_talkens) {
            //
            //         // Handle common errors
            //         if (!tts_talkens) {
            //             console.error("Error @ r2.PieceNewSpeak.renderAudio: HTK returned no talkens.");
            //             return;
            //         }
            //         else if (!edited_talkens) {
            //             console.error("Error @ r2.PieceNewSpeak.renderAudio: HTK returned talkens, but we're not sure where the edited talkens went!");
            //             return;
            //         }
            //         else if (edited_talkens.length !== tts_talkens.length) {
            //             console.warn("Warning @ r2.PieceNewSpeak.renderAudio: Length of HTK talkens != length of original talkens.");
            //             if (tts_talkens.length > edited_talkens.length) {
            //                 console.error("Error @ r2.PieceNewSpeak.renderAudio: # of tts talkens EXCEEDS # of edited talkens.");
            //                 return; // If # of tts talkens < edited, then continue, since it's better than doing nothing.
            //             }
            //         }
            //
            //         // 'Smooth' any missing timestamps so that they don't skip on playback:
            //         r2.audiosynth.smoothMissingTimestamps(tts_talkens);
            //
            //         // Convert to format of talkens expected by r2.gestureSynthesizer
            //         var gesynth_tks = [];
            //         for (var i = 0; i < tts_talkens.length; i++) {
            //             var tts_tk = tts_talkens[i];
            //             var src_tk = edited_talkens[i];
            //             gesynth_tks.push({
            //                base_annotid: (src_tk.audio && src_tk.audio.annotId && (tts_tk.bgn !== tts_tk.end) ? src_tk.audio.annotId : null),
            //                base_bgn: src_tk.bgn,
            //                base_end: src_tk.end,
            //                new_bgn: tts_tk.bgn,
            //                new_end: tts_tk.end,
            //                word: src_tk.word,
            //                pause_after: tts_tk.pauseAfter,
            //                pause_before: tts_tk.pauseBefore
            //             });
            //         }
            //         this._last_tts_talkens = gesynth_tks;
            //
            //         // Resynthesize gestures for this annotation for new TTS audio...
            //         r2.localLog.event('synth-gesture', annotId, {'talkensToSynth':gesynth_tks});
            //         console.warn('gesynth ----> ',gesynth_tks);
            //         r2.gestureSynthesizer.run(annotId, gesynth_tks);
            //
            //     }).bind(this));
            //
            // }).bind(this)).catch(function(err) {
            //     // error
            //
            // });

            //var streamingTTSAudioURL = audioRenderObj.streamURL;
            //this._cbAbortTTSDownload = audioRenderObj.abort;

            //console.log("TTS streaming audio URL: ", streamingTTSAudioURL);
            //r2App.annots[this.GetAnnotId()].SetRecordingAudioFileUrl(streamingTTSAudioURL, null); // While TTS audio is downloading, use streaming audio if user presses play.
        }
        else return new Promise(function(resolve, reject) {
            resolve(null);
        });
    };

    r2.PieceNewSpeak.prototype.updateSizeWithTextInput = function(){
        var getHeight = function($target){
            var $next = $target.next();
            if($next.length !== 0){
                return $next.offset().top-$target.offset().top;
            }
            else{
                return $target.innerHeight();
            }
        };

        var new_height = r2.viewCtrl.mapDomToDocScale(getHeight($(this.dom)));
        if(this._cnt_size.y != new_height){
            this._cnt_size.y = new_height;
            return true;
        }
        return false;
    };
    r2.PieceNewSpeak.prototype.DrawPiece = function(){
        var x_bgn = this.pos.x + this.GetTtIndent();
        var y_bgn = this.pos.y-r2Const.PIECEAUDIO_LINE_WIDTH;

        r2.canv_ctx.beginPath();
        r2.canv_ctx.moveTo(x_bgn, y_bgn);
        r2.canv_ctx.lineTo(x_bgn, y_bgn+this._cnt_size.y);
        r2.canv_ctx.moveTo(x_bgn, y_bgn+this._cnt_size.y);
        r2.canv_ctx.lineTo(x_bgn+this.GetTtIndentedWidth(), y_bgn+this._cnt_size.y);

        r2.canv_ctx.strokeStyle = r2.userGroup.GetUser(this._username).color_light_html;
        r2.canv_ctx.lineWidth = r2Const.PIECEAUDIO_LINE_WIDTH;
        r2.canv_ctx.lineCap = 'round';
        r2.canv_ctx.lineJoin = 'round';
        r2.canv_ctx.stroke();
    };
    r2.PieceNewSpeak.prototype.resizeDom = function(){
        this.updateSizeWithTextInput();
    };
    r2.PieceNewSpeak.prototype.setInnerHtml = function(inner_html){
        this.dom_textbox.innerHTML = inner_html;
        this.resizeDom();
    };

    r2.PieceNewSpeak.prototype.setCaptionTemporary = function(words){
        if (this.LIVE_CAPTIONING)
            this.setCaptionTemporaryLive(words);
        else {
            // do nothing with the temporary data
            r2.localLog.event('setCaptionTemporary', this._annotid, {'completeText':$(this.dom_textbox).text(),'rawTranscriptResults':words});
        }
    };
    r2.PieceNewSpeak.prototype.setCaptionFinal = function(words, alternatives){
        if (this.LIVE_CAPTIONING)
            this.setCaptionFinalLive(words, alternatives);
        else {

            if (!words || words.length === 0) return;

            var txt = $(this.dom_textbox).text();
            var i;
            var SENTENCE_PAUSE_THRESHOLD_MS = 1000;
            var PAUSE_THRESHOLD_MS = 30; // ignore pauses 30 ms and less.

            var pre_text = this._prev_pre ? this._prev_pre : (this.insert_idx > -1 ? $(this.dom_textbox).text().substring(0, this.insert_idx) : $(this.dom_textbox).text());
            var post_text = this.insert_idx > -1 ? $(this.dom_textbox).text().substring(this.insert_idx) : '';
            pre_text = pre_text.replace('●', '');
            post_text = post_text.replace('●', '');
            if (!this._prev_pre)
                this._prev_pre = pre_text;

            var bckup_words = [];
            words.forEach(function(w) { bckup_words.push(w); });
            console.log(' >>>> begin setCaptionFinal with words: ', bckup_words);

            words[0][0] = capitalize(words[0][0]); // capitalize first word of transcription

            var temp_texts = '';
            for(i = 0; i < words.length; ++i){
                var w = words[i];
                var $span = $(document.createElement('span'));

                if (i < words.length-1) {
                    var pause_len = 1000.0 * (words[i+1][1] - w[2]);
                    if (pause_len >= SENTENCE_PAUSE_THRESHOLD_MS) {
                        w[0] += '.'; // add period and capitalize next word...
                        words[i+1][0] = capitalize(words[i+1][0]);
                    } else if (pause_len > PAUSE_THRESHOLD_MS) {
                        w[0] += ' ♦';
                    }
                } else {
                    w[0] += '.';
                }

                $span.text(w[0]+' ');
                temp_texts += $span.text();
            }

            temp_texts = temp_texts.trim();

            // Fixes for inner insertion:
            // - uncapitalize first capital if prev word not capitalized, and
            // - remove period at end of results if next word starts lowercase, and
            // - if next char is a period, remove space at end of temp_texts, and
            // - repair space at end of pre if one doesn't exist
            if (this.insert_idx > -1) {
                var pre = pre_text.trim();
                var tt = temp_texts.trim();
                var post = post_text.trim();
                if (pre.length > 0) {
                    if (pre.charAt(pre.length-1).indexOf('.') === -1) { // if last char is not sentence-ending punctuation...
                        temp_texts = temp_texts.charAt(0).toLowerCase() + temp_texts.substring(1); // uncapitalized the first inserted word
                        tt = temp_texts.trim();
                        if (pre_text.charAt(pre_text.length-1) !== ' ') {
                            pre_text += ' '; // add space to end of pre_text
                        }
                    } else if (pre_text.charAt(pre_text.length-1) === '.') {
                        pre_text += ' ';
                    }
                }
                if (post.length > 0 && post.charAt(0) === post.charAt(0).toLowerCase()) { // if first char of next sentence is lowercase...
                    if (tt.charAt(tt.length-1).indexOf('.') > -1) { // ...and if last char is sentence-ending punctuation, then
                        temp_texts = tt.substring(0, tt.length-1) + ' '; // remove the punctuation
                    }
                }
                if (post.length > 0 && post.charAt(0) === '.')
                    temp_texts = temp_texts.trim();
            }

            var lastchar = temp_texts.charAt(temp_texts.length-1);
            if (lastchar === '.')
                temp_texts += ' ';
            else if (lastchar === ' ' && post_text.length > 0 && post_text.charAt(0) === ' ')
                temp_texts = temp_texts.trim();

            console.log(' >>>> temp_texts is ', temp_texts, ' words is ', words);
            var m = 0;
            temp_texts.trim().split(/\s+/g).forEach(function(w) {
                if (w.indexOf('♦') === -1) {
                    words[m][0] = w; // repair words to match fixed transcript
                    m++;
                }
            });

            this._prev_pre = pre_text + temp_texts;
            this._last_text = pre_text + temp_texts + post_text;
            this._last_text.replace('●', '');
            this.insert_idx = pre_text.length + temp_texts.length;

            r2.localLog.event('setCaptionFinal', this._annotid, {'finalText':temp_texts,'completeText':$(this.dom_textbox).text(),'transcriptResultsWithPunct':words,'rawTranscriptResults':bckup_words, 'rawTranscriptAlts':alternatives});

            if (!this._last_words)
                this._last_words = words;
            else {
                var lw = this._last_words;
                words.forEach(function(wrd) {
                    lw.push(wrd);
                });
            }

            if (this._waiting_for_watson) { // Microphone audio finished processing before Watson did, so we insert voice now --

                clearTimeout(this._waiting_for_watson_timeout);
                $(this.dom_textbox).children('.nsui-spinner').remove();

                $(this.dom_textbox).text(pre_text + temp_texts + post_text);
                this.insertVoice(this.insert_word_idx_before_rec, this._last_words, this.annotids[this.annotids.length-1]); // We have to append talkens b/c words might already have been set in onEndRecording. (since setCaptionFinal is called multiple times...)
                r2.localLog.event('appendVoice', this.annotids[this.annotids.length-1], {'words':words, 'url':this._last_audio_url});

                this._last_text = null;
                this._last_words = null;
                this._last_audio_url = null;
                this._waiting_for_watson = false;
                this._prev_pre = null;

                $(this.dom_textbox).focus(); // return user to selection
                r2.speak.restoreSelection(this.dom_textbox, {'start':this.insert_idx, 'end':this.insert_idx});

                r2App.invalidate_size = true;
                r2App.invalidate_page_layout = true;

                if (this.RENDER_AUDIO_IMMEDIATELY) {
                    console.warn('*RENDERING AUDIO*');
                    this.afterAudioRender = null;
                    this.renderAudio();
                }
            }

            this._temporary_n = 0;
            if(this.updateSizeWithTextInput()){
                r2App.invalidate_size = true;
                r2App.invalidate_page_layout = true;
            }
        }

        function capitalize(string) { // Thanks to Steve Harrison @ http://stackoverflow.com/a/1026087
            return string.charAt(0).toUpperCase() + string.slice(1);
        }
    };

    r2.PieceNewSpeak.prototype.setCaptionTemporaryLive = function(words) {
        var i;
        function capitalize(string) { // Thanks to Steve Harrison @ http://stackoverflow.com/a/1026087
            return string.charAt(0).toUpperCase() + string.slice(1);
        }

        $(this.dom_textbox).text(this.text_while_rec); // erase changes

        var bckup_words = [];
        words.forEach(function(w) { bckup_words.push(w); });

        var pre_text = this.insert_idx > -1 ? $(this.dom_textbox).text().substring(0, this.insert_idx) : $(this.dom_textbox).text();
        var post_text = this.insert_idx > -1 ? $(this.dom_textbox).text().substring(this.insert_idx) : '';

        console.log('pre_text', pre_text);
        console.log('post_text', post_text);

        var temp_texts = '';
        var SENTENCE_PAUSE_THRESHOLD_MS = 1000;
        var PAUSE_THRESHOLD_MS = 30; // ignore pauses 30 ms and less.
        for(i = 0; i < words.length; ++i){
            var w = words[i];
            if (i === 0) w[0] = capitalize(w[0]); // capitalize first word of transcription
            var $span = $(document.createElement('span'));

            if (i < words.length-1) {
                var pause_len = 1000.0 * (words[i+1][1] - w[2]);
                if (pause_len >= SENTENCE_PAUSE_THRESHOLD_MS) {
                    w[0] += '.'; // add period and capitalize next word...
                    words[i+1][0] = capitalize(words[i+1][0]);
                } else if (pause_len > PAUSE_THRESHOLD_MS) {
                    w[0] += ' ♦';
                }
            } else {
                w[0] += '.';
            }

            $span.text(w[0]+' ');
            temp_texts += $span.text();
            //$(this.dom_textbox).append($span);
        }

        // Fixes for inner insertion:
        // - uncapitalize first capital if prev word not capitalized, and
        // - remove period at end of results if next word starts lowercase, and
        // - if next char is a period, remove space at end of temp_texts, and
        // - repair space at end of pre if one doesn't exist
        if (this.insert_idx > -1) {
            var pre = pre_text.trim();
            var tt = temp_texts.trim();
            var post = post_text.trim();
            if (pre.length > 0) {
                if (pre.charAt(pre.length-1).indexOf('.') === -1) { // if last char is not sentence-ending punctuation...
                    temp_texts = temp_texts.charAt(0).toLowerCase() + temp_texts.substring(1); // uncapitalized the first inserted word
                    tt = temp_texts.trim();
                    if (pre_text.charAt(pre_text.length-1) !== ' ') {
                        pre_text += ' '; // add space to end of pre_text
                    }
                } else if (pre_text.charAt(pre_text.length-1) === '.') {
                    pre_text += ' ';
                }
            }
            if (post.length > 0 && post.charAt(0) === post.charAt(0).toLowerCase()) { // if first char of next sentence is lowercase...
                if (tt.charAt(tt.length-1).indexOf('.') > -1) { // ...and if last char is sentence-ending punctuation, then
                    temp_texts = tt.substring(0, tt.length-1) + ' '; // remove the punctuation
                }
            }
            if (post.length > 0 && post.charAt(0) === '.')
                temp_texts = temp_texts.trim();
        }

        console.log('temp_texts', temp_texts);
        $(this.dom_textbox).text(pre_text + temp_texts + post_text);

        var blurred = !$(this.dom_textbox).is(':focus');
        var fixed_insert_idx = pre_text.length + temp_texts.length;
        r2.speak.restoreSelection(this.dom_textbox, {'start':fixed_insert_idx, 'end':fixed_insert_idx});
        if (blurred) $(this.dom_textbox).blur();

        r2.localLog.event('setCaptionTemporary', this._annotid, {'temporaryText':temp_texts,'completeText':$(this.dom_textbox).text(),'transcriptResultsWithPunct':words,'rawTranscriptResults':bckup_words});

        this._temporary_n = words.length;
        if(this.updateSizeWithTextInput()){
            r2App.invalidate_size = true;
            r2App.invalidate_page_layout = true;
        }
    };
    r2.PieceNewSpeak.prototype.setCaptionFinalLive = function(words, alternatives){

        var i;
        var SENTENCE_PAUSE_THRESHOLD_MS = 1000;
        var PAUSE_THRESHOLD_MS = 30; // ignore pauses 30 ms and less.
        function capitalize(string) { // Thanks to Steve Harrison @ http://stackoverflow.com/a/1026087
            return string.charAt(0).toUpperCase() + string.slice(1);
        }

        $(this.dom_textbox).text(this.text_while_rec);

        var pre_text = this.insert_idx > -1 ? $(this.dom_textbox).text().substring(0, this.insert_idx) : $(this.dom_textbox).text();
        var post_text = this.insert_idx > -1 ? $(this.dom_textbox).text().substring(this.insert_idx) : '';

        //for(i = 0; i < this._temporary_n; ++i){
        //    $(this.dom_textbox).find(':last-child').remove();
        //}

        var bckup_words = [];
        words.forEach(function(w) { bckup_words.push(w); });
        console.log(' >>>> begin setCaptionFinal with words: ', bckup_words);

        words[0][0] = capitalize(words[0][0]); // capitalize first word of transcription

        var temp_texts = '';
        for(i = 0; i < words.length; ++i){
            var w = words[i];
            var $span = $(document.createElement('span'));

            if (i < words.length-1) {
                var pause_len = 1000.0 * (words[i+1][1] - w[2]);
                if (pause_len >= SENTENCE_PAUSE_THRESHOLD_MS) {
                    w[0] += '.'; // add period and capitalize next word...
                    words[i+1][0] = capitalize(words[i+1][0]);
                } else if (pause_len > PAUSE_THRESHOLD_MS) {
                    w[0] += ' ♦';
                }
            } else {
                w[0] += '.';
            }

            $span.text(w[0]+' ');
            temp_texts += $span.text();

            //$(this.dom_textbox).append($span);
        }

        temp_texts = temp_texts.trim();

        // Fixes for inner insertion:
        // - uncapitalize first capital if prev word not capitalized, and
        // - remove period at end of results if next word starts lowercase, and
        // - if next char is a period, remove space at end of temp_texts, and
        // - repair space at end of pre if one doesn't exist
        if (this.insert_idx > -1) {
            var pre = pre_text.trim();
            var tt = temp_texts.trim();
            var post = post_text.trim();
            if (pre.length > 0) {
                if (pre.charAt(pre.length-1).indexOf('.') === -1) { // if last char is not sentence-ending punctuation...
                    temp_texts = temp_texts.charAt(0).toLowerCase() + temp_texts.substring(1); // uncapitalized the first inserted word
                    tt = temp_texts.trim();
                    if (pre_text.charAt(pre_text.length-1) !== ' ') {
                        pre_text += ' '; // add space to end of pre_text
                    }
                } else if (pre_text.charAt(pre_text.length-1) === '.') {
                    pre_text += ' ';
                }
            }
            if (post.length > 0 && post.charAt(0) === post.charAt(0).toLowerCase()) { // if first char of next sentence is lowercase...
                if (tt.charAt(tt.length-1).indexOf('.') > -1) { // ...and if last char is sentence-ending punctuation, then
                    temp_texts = tt.substring(0, tt.length-1) + ' '; // remove the punctuation
                }
            }
            if (post.length > 0 && post.charAt(0) === '.')
                temp_texts = temp_texts.trim();
        }

        console.log(' >>>> temp_texts is ', temp_texts, 'words is ', words);
        var m = 0;
        temp_texts.trim().split(/\s+/g).forEach(function(w) {
            if (w.indexOf('♦') === -1) {
                words[m][0] = w; // repair words to match fixed transcript
                m++;
            }
        });
        $(this.dom_textbox).text(pre_text + temp_texts + post_text); // append text
        this.text_while_rec = $(this.dom_textbox).text();
        this.insert_idx = pre_text.length + temp_texts.length;
        this.word_insert_idx = pre_text.split(/\s+/g).length-1;
        var blurred = !$(this.dom_textbox).is(':focus');
        r2.speak.restoreSelection(this.dom_textbox, {'start':this.insert_idx, 'end':this.insert_idx});
        if (blurred) $(this.dom_textbox).blur();

        r2.localLog.event('setCaptionFinal', this._annotid, {'finalText':temp_texts,'completeText':$(this.dom_textbox).text(),'transcriptResultsWithPunct':words,'rawTranscriptResults':bckup_words, 'rawTranscriptAlts':alternatives});

        if (!this._last_words)
            this._last_words = words;
        else {
            var lw = this._last_words;
            words.forEach(function(wrd) {
                lw.push(wrd);
            });
        }

        if (this._last_audio_url) { // Microphone audio finished processing before Watson did, so we insert voice now --

            this.insertVoice(this.insert_word_idx_before_rec, words, this.annotids[this.annotids.length-1]); // We have to append talkens b/c words might already have been set in onEndRecording. (since setCaptionFinal is called multiple times...)
            r2.localLog.event('appendVoice', this.annotids[this.annotids.length-1], {'words':words, 'url':this._last_audio_url});

            this._last_words = null;
            this._last_audio_url = null;
            this._waiting_for_watson = false;

            $(this.dom_textbox).focus(); // return user to selection
            r2.speak.restoreSelection(this.dom_textbox, {'start':this.insert_idx, 'end':this.insert_idx});

            if (this.RENDER_AUDIO_IMMEDIATELY) {
                this.afterAudioRender = null;
                this.renderAudio();
            }
        }

        this._temporary_n = 0;
        if(this.updateSizeWithTextInput()){
            r2App.invalidate_size = true;
            r2App.invalidate_page_layout = true;
        }
    };
    r2.PieceNewSpeak.prototype.bgnCommenting = function(recording_annot_id){
        r2App.annots[recording_annot_id].setIsBaseAnnot();
        this.annotids.push(recording_annot_id);
        this.text_before_rec = $(this.dom_textbox).text();
        this.text_while_rec = this.text_before_rec;
        this.insert_word_idx_before_rec = 0;
        this.insert_idx = 0;
        this.recording_mode = true;
        this._prev_pre = null;

        this.updateSpeakCtrl();

        // Save the cursor position, flatten the div, and then restore it.
        if ($(this.dom_textbox).text().length > 0) {
            var cur = r2.speak.saveSelection(this.dom_textbox);
            this.blur_idx = cur;
            this.insert_range = cur;
            $(this.dom_textbox).text($(this.dom_textbox).text()); // strange but true
            r2.speak.restoreSelection(this.dom_textbox, cur); // hope this works!
            this.insert_idx = r2.speak.saveSelection(this.dom_textbox).start; // simplified range...
            this.insert_word_idx_before_rec = this.text_before_rec.substring(0, this.insert_idx).split(/\s+/g).length - 1;
            console.log('Recorded cursor range: ', this.insert_range);

            r2.localLog.event('cmd-insertion', this._annotid, {'input': 'key-enter', 'cursor_pos': this.insert_range});

        } else this.insert_idx = -1;

        // Insert blinking 'live recording' indicator.
        if (!this.LIVE_CAPTIONING) {

            var insertSpanAtCaretIdx = function($span, idx, $textdiv) {
                var txt = $textdiv.text();
                $textdiv.text(txt.substring(0, idx));
                $textdiv.append($span);
                $textdiv[0].innerHTML += txt.substring(idx);
            };

            var getPopUpPos = function(textbox, span) {
                var tb_bbox = textbox.getBoundingClientRect();
                var l_bbox = span.getBoundingClientRect();
                console.log(l_bbox);
                return {
                    x: (span.offsetLeft + l_bbox.width/2.0)*r2Const.FONT_SIZE_SCALE/r2.dom.getCanvasWidth() + 'em',
                    y: (span.offsetTop + l_bbox.height)*r2Const.FONT_SIZE_SCALE/r2.dom.getCanvasWidth() + 'em'
                };
                return {
                    x: (l_bbox.left-tb_bbox.left)*r2Const.FONT_SIZE_SCALE/r2.dom.getCanvasWidth() + 'em',
                    y: (l_bbox.top+l_bbox.height-tb_bbox.top)*r2Const.FONT_SIZE_SCALE/r2.dom.getCanvasWidth() + 'em'
                };
            };

            if (this.insert_idx > -1)
                this._prev_pre = $(this.dom_textbox).text().substring(0, this.insert_idx);
            else
                this._prev_pre = '';

            var $rec_span = $(document.createElement('span'));
            $rec_span.text('●');
            $rec_span.addClass('nsui-blinkred');
            insertSpanAtCaretIdx($rec_span, this.insert_idx, $(this.dom_textbox));

            // Show live waveform popup
            setTimeout(function() { // give DOM chance to update offsets...
                r2.tooltipAudioWaveform.show($(this.dom_textbox).parent(),
                                             getPopUpPos(this.dom_textbox, $('.nsui-blinkred')[0]));
            }.bind(this), 0);

            if (this.insert_idx > -1)
                r2.speak.restoreSelection(this.dom_textbox, this.insert_range);
        }
    };
    r2.PieceNewSpeak.prototype.onEndRecording = function(audioURL) {
        console.log("onEndRecording with words", this, this._last_words, "url", audioURL);
        this.recording_mode = false;
        r2.tooltipAudioWaveform.dismiss();

        if (!this.LIVE_CAPTIONING) {
            var ui_spinner = $('<img class="nsui-spinner">');
            ui_spinner.attr('src', 'img/ui-load-rolling.gif');
            ui_spinner.attr('width', $(this.dom_textbox).children('.nsui-blinkred').width()*1.3);
            ui_spinner.attr('height', $(this.dom_textbox).children('.nsui-blinkred').width()*1.3);
            $(this.dom_textbox).children('.nsui-blinkred').after(ui_spinner);
            $(this.dom_textbox).children('.nsui-blinkred').remove();
            //$(this.dom_textbox).text($(this.dom_textbox).text().replace('●', ''));
            r2.speak.restoreSelection(this.dom_textbox, {'start':this.insert_idx, 'end':this.insert_idx});
        }

        var afterRecording = function() {

            console.log(' @ afterRecording callback // ');

            if (!this.LIVE_CAPTIONING) {
                if (this._last_text) $(this.dom_textbox).text(this._last_text);
                $(this.dom_textbox).children('.nsui-spinner').remove();
            }
            this.insertVoice(this.insert_word_idx_before_rec, this._last_words, this.annotids[this.annotids.length-1]);
            r2.localLog.event('insertVoice', this.annotids[this.annotids.length-1], {'words':this._last_words, 'url':audioURL});

            this._last_words = null;
            this._last_audio_url = null;
            this._waiting_for_watson = false;
            this._waiting_for_watson_timeout = null;
            this._prev_pre = null;

            r2.speak.restoreSelection(this.dom_textbox, {'start':this.insert_idx, 'end':this.insert_idx});
            $(this.dom_textbox).focus();

            r2App.invalidate_size = true;
            r2App.invalidate_page_layout = true;

            if (this.RENDER_AUDIO_IMMEDIATELY) {
                console.warn('*RENDERING AUDIO*');
                this.afterAudioRender = null;
                this.renderAudio();
            }

        }.bind(this);

        // We're waiting on the transcript, so just store the URL for when setCaptionFinal is called.
        // console.warn("r2.PieceSimpleSpeech: onEndRecording: Could not find transcript.");
        var waittime = this._prev_pre ? 2000 : 5000; // wait 5 seconds if we haven't received anything from Watson yet.
        this._last_audio_url = audioURL;
        this._waiting_for_watson = true;
        this._waiting_for_watson_timeout = setTimeout(function() {
            this._waiting_for_watson = false; // wait 2secs then cancel
            afterRecording();
        }.bind(this), waittime);

        // DEBUG
        //r2.localLog.download();
    };
    r2.PieceNewSpeak.prototype.insertVoice = function(idx, words, annotId) {
        if (!words || words.length === 0) return;
        console.warn('insertVoice with idx', idx, words);
        if (idx > 0) {
            this.speak_ctrl.flatten(); // edited becomes base
        }
        this.speak_ctrl.insertVoice(idx, words, annotId); // for now
        this.updateSpeakCtrl();
        this.renderAudio();
    };
    r2.PieceNewSpeak.prototype.appendVoice = function(words, annotId) {
        if (words.length === 0) return;
        this.speak_ctrl.appendVoice(words, annotId); // for now
        this.updateSpeakCtrl();
        this.renderAudio();
    };
    r2.PieceNewSpeak.prototype.doneCaptioning = function(){
        this.Focus();
    };
    r2.PieceNewSpeak.prototype.Focus = function(){
        this.dom_textbox.focus();
    };
    r2.PieceNewSpeak.prototype.DrawPieceDynamic = function(cur_annot_id, canvas_ctx, force) {
        // Returns an array with all occurences of 'matchstr' in string array 'strarr'
        // merged into the string immediately to the left and separated by 'separator'.
        function mergeLeft(strarr, matchstr, separator) {
            var i;
            for (i = 0; i < strarr.length; i++) {
                var s = strarr[i];
                if (s === matchstr) {
                    if (i > 0) strarr[i-1] += separator + matchstr; // mergeleft
                    strarr.splice(i, 1); // remove matched element
                    i--;
                }
            }
        }

        // disable for now
        if (this._annotid != cur_annot_id || !r2.audioPlayer.isPlaying() || !this._last_tts_talkens) {
            if (this._dynamic_setup) this.EndDrawDynamic();
            return;
        }

        var wrds_without_pauses = $(this.dom_textbox).text().replace(/♦/g, '').trim().split(/\s+/g);
        var wrds = $(this.dom_textbox).text().trim().split(/\s+/g);
        var tks = $.extend(true, [], this._last_tts_talkens);
        if (wrds_without_pauses.length !== tks.length) {
            if (this._dynamic_setup) {
                this.EndDrawDynamic();
            }
            console.log('# words != # talkens.', wrds.length, tks.length);
            return;
        } else if (!this._dynamic_setup) {

            mergeLeft(wrds, '♦', ' ');

            if (wrds.length !== tks.length) {
                console.warn('After mergeLeft of ♦s, # words still != # talkens.');
                return;
            }

            var n; // Mirror changes in talken words.
            for(n = 0; n < wrds.length; n++) {
                tks[n].word = wrds[n];
            }
            this._stored_tks = tks;

            /*var extra_split = [];
            wrds.forEach(function(w) {
                if (w.trim().length > 1 && w.indexOf('♦') > -1) {
                    var str = w.split('♦');
                    str.forEach(function(s) {
                        extra_split.push(s);
                    });
                } else  extra_split.push(w);
            });
            wrds = extra_split;*/

            // var j = 0; // Repair stored transcript + add pause breaks.
            // var k = 1;
            // for(; j < tks.length && k < wrds.length; j++) {
            //     var tk = tks[j];
            //     var tk_next = j < tks.length-1 ? tks[j+1] : null;
            //     var w = wrds[k];
            //
            //     console.log(tk.word, tk_next?tk_next.word:null, w);
            //
            //     if (w.trim() === '♦') {
            //         if (tk.pause_after > 0) {
            //             tks.splice(j+1, 0, { new_bgn:tk.new_end+0.00001,
            //                               new_end:tk.new_end + tk.pause_after,
            //                               word:'♦',
            //                               pause_after:0,
            //                               pause_before:0 });
            //             j++;
            //         }
            //         else if (tk_next && tk_next.pause_before > 0) {
            //             tks.splice(j, 0, { new_bgn:tk_next.new_bgn-tk_next.pause_before,
            //                               new_end:tk_next.new_bgn-0.00001,
            //                               word:'♦',
            //                               pause_after:0,
            //                               pause_before:0 });
            //             j++;
            //         }
            //         else {
            //             tks.splice(j+1, 0, { new_bgn:tk.new_end+0.00001,
            //                               new_end:tk.new_end + tk.pause_after,
            //                               word:'♦',
            //                               pause_after:0,
            //                               pause_before:0 });
            //             j++;
            //         }
            //     }
            //
            //     k++;
            // }
            //
            // console.log(tks)
            // this._stored_tks = tks;
        }

        /*var wrds = $(this.dom_textbox).text().replace(/♦/g, '').trim().split(/\s+/g);
        var tks = $.extend(true, [], this._last_tts_talkens);
        if (wrds.length !== tks.length) {
            if (this._dynamic_setup) {
                this.EndDrawDynamic();
            }
            console.log('# words != # talkens.', wrds, tks);
            return;
        } else {
            var j = 0; // Repair stored transcript + add pause breaks.
            var k = 0;
            for(; j < tks.length; j++) {
                tk = tks[j];
                tk.word = wrds[k];
                if (tk.pause_after > 0) {
                    tks.splice(j+1, 0, { new_bgn:tk.new_end+0.00001,
                                      new_end:tk.new_end + tk.pause_after,
                                      word:'♦',
                                      pause_after:0,
                                      pause_before:0 });
                    j++;
                }
                else if (tk.pause_before > 0) {
                    if (j === 0 || tks[j-1].word != '♦') {
                        tks.splice(j, 0, { new_bgn:tk.new_bgn-tk.pause_before,
                                          new_end:tk.new_bgn-0.00001,
                                          word:'♦',
                                          pause_after:0,
                                          pause_before:0 });
                        j++;
                    }
                }
                k++;
            }
        }*/

        tks = this._stored_tks;

        var $txtbox = $(this.dom_textbox);
        var curtime = r2App.cur_audio_time;
        var tk, srctk;

        if (!this._dynamic_setup) {
            $txtbox.text('');
            tks.forEach(function(tk) {
                var $span = $(document.createElement('span'));
                $span.text(tk.word + ' ');
                $span[0].onclick = function(e) {
                    console.log('set playback time to ', tk.new_bgn+4);
                    r2.audioPlayer.setPlaybackTime(tk.new_bgn);
                };
                $txtbox.append($span);
            });
            $txtbox[0].addEventListener('input', this.EndDrawDynamic.bind(this));
            //$txtbox[0].addEventListener('focus', this.EndDrawDynamic.bind(this));
            this._dynamic_setup = true;
        }

        var i = 0;
        tks.forEach(function(tk) {
            var $span = $txtbox.children().eq(i);
            if (curtime >= tk.new_bgn && curtime < tk.new_end) {
                $span.css('color','goldenrod');
            } else if (curtime > tk.new_end) {
                $span.css('color','gray'); // previous talkens
            } else {
                $span.css('color','black'); // upcoming talkens
            }
            i++;
        });

    };
    r2.PieceNewSpeak.prototype.EndDrawDynamic = function() {
        var $txtbox = $(this.dom_textbox);
        console.log('END DRAW DYNAMIC');
        if (r2.audioPlayer.isPlaying()) {
            r2.audioPlayer.stop();
            r2.audioPlayer.setPlaybackTime(0);
        }
        $txtbox.css('color', 'black');
        $txtbox.children().each(function() {
            $(this).css('color', 'black');
            $(this).css('font-weight','normal');
        });
        this._dynamic_setup = false;
    };


    /*
     * PieceSimpleSpeech
     */
    r2.PieceSimpleSpeech = function(){
        r2.Piece.call(this);
        this._annotid = null;
        this._username = null;

        this.dom = null;
        this.dom_textbox = null;
        this.done_recording = true;
        this.done_captioning = true;
        this.annotids = [];
        this.ui_type = r2App.RecordingUI.SIMPLE_SPEECH;
    };
    r2.PieceSimpleSpeech.prototype = Object.create(r2.Piece.prototype);
    r2.PieceSimpleSpeech.prototype.Destructor = function(){
        r2.Piece.prototype.Destructor.apply(this);
    };
    r2.PieceSimpleSpeech.prototype.GetAnnotId = function(){
        return this._annotid;
    };
    r2.PieceSimpleSpeech.prototype.SetPieceSimpleSpeech = function(
        anchor_pid, annotid, username, inner_html, live_recording, ui_type
    ){
        this._annotid = annotid;
        this._username = username;
        this._waiting_for_watson = false;
        this.ui_type = ui_type;

        var dom = this.CreateDom();

        r2.dom_model.appendPieceEditableAudio(
            this._username,
            this._annotid,
            this.GetId(),
            anchor_pid,
            this._creationTime,
            dom,
            this,
            live_recording
        );

        this.resizeDom();

        return dom;
    };
    r2.PieceSimpleSpeech.prototype.GetAnnotId = function(){
        if(this._annotid != null){
            return this._annotid;
        }
    };
    r2.PieceSimpleSpeech.prototype.GetAnchorTo = function(){
        // anchorTo: {type: 'PieceText', id: pid, page: 2} or
        var anchorCmd = {};
        anchorCmd.type = 'PieceSimpleSpeech';
        anchorCmd.id = this.GetId();
        anchorCmd.page = this.GetNumPage();
        return anchorCmd;
    };
    r2.PieceSimpleSpeech.prototype.CreateDom = function(){
        this.dom = document.createElement('div');
        this.dom.classList.toggle('r2_piece_editable_audio', true);
        this.dom.classList.toggle('unselectable', true);
        this.dom.setAttribute('aria-label', 'text comment');
        this.dom.setAttribute('role', 'article');

        this.dom_tr = document.createElement('div');
        this.dom_tr.classList.toggle('r2_piece_editable_audio_tr', true);
        this.dom_tr.classList.toggle('unselectable', true);
        $(this.dom_tr).css('left', this.GetTtIndent()*r2Const.FONT_SIZE_SCALE+'em');
        $(this.dom_tr).css('width', this.GetTtIndentedWidth()*r2Const.FONT_SIZE_SCALE+'em');
        this.dom.appendChild(this.dom_tr);

        var dom_overlay = document.createElement('div');
        dom_overlay.classList.toggle('ssui-overlay', true);
        dom_overlay.classList.toggle('unselectable', true);

        this.dom_tr.appendChild(dom_overlay);

        this.dom_textbox = document.createElement('div');
        this.dom_textbox.setAttribute('contenteditable', this._username === r2.userGroup.cur_user.name);
        this.dom_textbox.classList.toggle('r2_piece_simplespeech', true);
        this.dom_textbox.classList.toggle('text_selectable', true);
        this.dom_textbox.style.color = r2.userGroup.GetUser(this._username).color_piecekeyboard_text;
        this.dom_tr.appendChild(this.dom_textbox);


        // Create edit controller
        this.speak_ctrl = new r2.speak.controller();

        // SimpleSpeech UI wrapper
        this.simplespeech = new r2.transcriptionUI(
            this.dom_textbox, dom_overlay, this._annotid, this.annotids, this.ui_type
        );

        /* add event handlers*/
        this.simplespeech.on_input = function() {
            if(this.updateSizeWithTextInput()){
                r2App.invalidate_size = true;
                r2App.invalidate_page_layout = true;
                r2App.invalidate_dynamic_scene = true;
                r2App.invalidate_static_scene = true;
            }
        }.bind(this);

        this.simplespeech.synthesizeAndPlay = function(content_changed, time){
            return new Promise(function(resolve, reject){
                if(content_changed){
                    this.simplespeech.synthesizeNewAnnot(this._annotid).then(
                        function(){
                            r2.rich_audio.play(this._annotid, time);
                            resolve();
                        }.bind(this)
                    );
                }
                else{
                    r2.rich_audio.play(this._annotid,time);
                    resolve();
                }
            }.bind(this));
        }.bind(this);

        this.simplespeech.insertRecording = function(){
            r2.recordingCtrl.set(
                this._parent,
                { // option
                    ui_type: r2App.RecordingUI.SIMPLE_SPEECH,
                    caption_major: true,
                    piece_to_insert: this
                }
            );
        }.bind(this);

        this.simplespeech.bgn_streaming = function(){
            r2.radialMenu.bgnLoading('rm_'+r2.util.escapeDomId(this._annotid));
        }.bind(this);
        this.simplespeech.end_streaming = function(){
            r2.radialMenu.endLoading('rm_'+r2.util.escapeDomId(this._annotid));
        }.bind(this);



        this.dom_textbox.addEventListener('focus', function(event){
            r2App.cur_focused_piece_keyboard = this;
            var color = r2.userGroup.GetUser(this._username).color_piecekeyboard_box_shadow;
            this.dom_textbox.style.boxShadow = "0 0 0.2em "+color+" inset, 0 0 0.2em "+color;
            $(this.dom).css("pointer-events", 'auto');
            $(this.dom_textbox).toggleClass('editing', true);
        }.bind(this));
        r2.keyboard.pieceEventListener.setTextbox(this.dom_textbox);

        this.dom_textbox.addEventListener('blur', function(event){
            // remove cursor complete from the textbox,
            // otherwise it will interfere with mouse interaction for other visaul entities
            window.getSelection().removeAllRanges();

            r2App.cur_focused_piece_keyboard = null;
            this.dom_textbox.style.boxShadow = "none";

            //$(this.dom).css("pointer-events", 'none');
            $(this.dom_textbox).toggleClass('editing', false);
        }.bind(this));
        /* add event handlers*/

        return this.dom;
    };
    r2.PieceSimpleSpeech.prototype.updateSizeWithTextInput = function(){
        var getHeight = function($target){
            var $next = $target.next();
            if($next.length !== 0){
                return $next.offset().top-$target.offset().top;
            }
            else{
                return $target.innerHeight();
            }
        };

        var new_height = r2.viewCtrl.mapDomToDocScale(getHeight($(this.dom)));
        if(this._cnt_size.y != new_height){
            this._cnt_size.y = new_height;
            return true;
        }
        return false;
    };
    r2.PieceSimpleSpeech.prototype.DrawPiece = function(){
        var x_bgn = this.pos.x + this.GetTtIndent();
        var y_bgn = this.pos.y-r2Const.PIECEAUDIO_LINE_WIDTH;

        r2.canv_ctx.beginPath();
        r2.canv_ctx.moveTo(x_bgn, y_bgn);
        r2.canv_ctx.lineTo(x_bgn, y_bgn+this._cnt_size.y);
        r2.canv_ctx.moveTo(x_bgn, y_bgn+this._cnt_size.y);
        r2.canv_ctx.lineTo(x_bgn+this.GetTtIndentedWidth(), y_bgn+this._cnt_size.y);

        r2.canv_ctx.strokeStyle = r2.userGroup.GetUser(this._username).color_light_html;
        r2.canv_ctx.lineWidth = r2Const.PIECEAUDIO_LINE_WIDTH;
        r2.canv_ctx.lineCap = 'round';
        r2.canv_ctx.lineJoin = 'round';
        r2.canv_ctx.stroke();
    };
    r2.PieceSimpleSpeech.prototype.DrawPieceDynamic = function(cur_annot_id, canvas_ctx, force) {
        if (this._annotid != cur_annot_id) {
            return;
        }
        this.simplespeech.drawDynamic(r2App.cur_audio_time);
    };
    r2.PieceSimpleSpeech.prototype.resizeDom = function(){
        if(this.updateSizeWithTextInput()){
            r2App.invalidate_size = true;
            r2App.invalidate_page_layout = true;
            r2App.invalidate_dynamic_scene = true;
            r2App.invalidate_static_scene = true;
        }
    };
    r2.PieceSimpleSpeech.prototype.bgnCommenting = function(recording_annot_id){
        r2App.annots[recording_annot_id].setIsBaseAnnot();
        this.annotids.push(recording_annot_id);
        this.done_recording = false;
        this.done_captioning = false;
        this.simplespeech.bgnCommenting();
    };
    r2.PieceSimpleSpeech.prototype.bgnCommentingAsync = function(recording_annot_id){
        this.simplespeech.bgnCommentingAsync();
    };
    r2.PieceSimpleSpeech.prototype.setCaptionTemporary = function(words){
        this.simplespeech.setCaptionTemporary(words, this.annotids[this.annotids.length-1]);
        this.resizeDom();
    };
    r2.PieceSimpleSpeech.prototype.setCaptionFinal = function(words){
        this.simplespeech.setCaptionFinal(words, this.annotids[this.annotids.length-1]);
        this.resizeDom();
    };
    r2.PieceSimpleSpeech.prototype.doneCaptioning = function(){
        this.Focus();
        this.done_captioning = true;
        this.doneCommentingAsync();
        this.resizeDom();
    };
    r2.PieceSimpleSpeech.prototype.onEndRecording = function(audioURL) {
        this.done_recording = true;
        this.simplespeech.endCommenting();
        r2.radialMenu.bgnLoading('rm_'+r2.util.escapeDomId(this._annotid));
        this.doneCommentingAsync();
    };
    r2.PieceSimpleSpeech.prototype.doneCommentingAsync = function() {
        if(this.done_captioning && this.done_recording){
            r2.radialMenu.endLoading('rm_'+r2.util.escapeDomId(this._annotid));
            this.simplespeech.doneCommentingAsync();
            this.simplespeech.synthesizeNewAnnot(this._annotid);
        }
    };
    r2.PieceSimpleSpeech.prototype.Focus = function(){
        this.dom_textbox.focus();
    };


    /*
     * PieceKeyboard
     */
    r2.PieceKeyboard = function() {
        r2.Piece.call(this);
        this._annotid = null;
        this._username = null;

        this.dom = null;
        this.dom_textbox = null;

        this.__private_shift_x = null;
        this._isprivate = false;

        this.__contentschanged = false;
    };
    r2.PieceKeyboard.prototype = Object.create(r2.Piece.prototype);

    r2.PieceKeyboard.prototype.Destructor = function(){
        r2.Piece.prototype.Destructor.apply(this);
    };
    r2.PieceKeyboard.prototype.GetAnchorTo = function(){
        // anchorTo: {type: 'PieceText', id: pid, page: 2} or
        var anchorCmd = {};
        anchorCmd.type = 'PieceKeyboard';
        anchorCmd.id = this.GetId();
        anchorCmd.page = this.GetNumPage();
        return anchorCmd;
    };
    r2.PieceKeyboard.prototype.WasChanged = function(){
        return this.__contentschanged;
    };
    r2.PieceKeyboard.prototype.SetText = function(text){
        this.dom_textbox.innerHTML = text;
        this.ResizeDom();
    };
    r2.PieceKeyboard.prototype.ExportToCmd = function(){
        // time: 2014-12-21T13...
        // user: 'red user'
        // op: 'CreateComment'
        // type: 'CommentText'
        // anchorTo: {type: 'PieceText or PieceTeared', id: pid, page: 2} or
        // data: {aid: ..., text: "this is a", isprivate:}
        var cmd = {};
        cmd.time = (new Date(this._creationTime)).toISOString();
        cmd.user = this._username;
        cmd.op = "CreateComment";
        cmd.type = "CommentText";
        cmd.anchorTo = this._parent.GetAnchorTo();
        cmd.data = {};
        cmd.data.pid = this._id;
        cmd.data.aid = this._annotid;
        cmd.data.text = this.dom_textbox.innerHTML;
        cmd.data.isprivate = this._isprivate;

        return cmd;
    };
    r2.PieceKeyboard.prototype.ExportToTextChange = function(){
        // time: 2014-12-21T13...
        // user: 'red user'
        // op: 'ChangeProperty'
        // type: 'PieceKeyboardTextChange'
        // target: {type: 'PieceKeyboard', pid: pid, page: 2}
        // data: 'lorem ipsum ...'
        var cmd = {};
        cmd.time = (new Date()).toISOString();
        cmd.user = this._username;
        cmd.op = "ChangeProperty";
        cmd.type = "PieceKeyboardTextChange";
        cmd.target = this.GetTargetData();
        cmd.data = this.dom_textbox.innerHTML;

        return cmd;
    };

    r2.PieceKeyboard.prototype.ExportToCmdPubPrivate = function(){
        // time: 2014-12-21T13...
        // user: 'red user'
        // op: 'ChangeProperty'
        // type: 'PieceKeyboardPubPrivate'
        // target: {type: 'PieceKeyboard', pid: pid, page: 2}
        // data: 'private' or 'pub'
        var cmd = {
            time: (new Date()).toISOString(),
            user: this._username,
            op: "ChangeProperty",
            type: "PieceKeyboardPubPrivate",
            target: this.GetTargetData(),
            data: this._isprivate ? "private" : "pub"
        };
        return cmd;
    };
    r2.PieceKeyboard.prototype.ExportToCmdDeleteComment = function(){
        // time: 2014-12-21T13...
        // user: 'red user'
        // op: 'DeleteComment'
        // target: {type: 'PieceKeyboard', pid: pid, page: 2}
        var cmd = {};
        cmd.time = (new Date()).toISOString();
        cmd.user = this._username;
        cmd.op = "DeleteComment";
        cmd.target = this.GetTargetData();
        return cmd;
    };
    r2.PieceKeyboard.prototype.SetPieceKeyboard = function(anchor_pid, annotid, username, text, isprivate, isOnLeftColumn){
        this._annotid = annotid;
        this._username = username;

        var dom = this.CreateDom();
        this.SetText(text);
        this._isprivate = isprivate;
        if(this._isprivate){
            //$(this.dom_btn_pub).toggleClass("fa-flip-horizontal", r2.util.myXOR(true, isOnLeftColumn));
        }
        else{
            //$(this.dom_btn_pub).toggleClass("fa-flip-horizontal", r2.util.myXOR(false, isOnLeftColumn));
        }

        r2.dom_model.appendPieceKeyboard(
            this._username,
            this._annotid,
            this.GetId(),
            anchor_pid,
            this._creationTime,
            dom,
            this
        );

        this.UpdateSizeWithTextInput();

        return dom;
    };
    r2.PieceKeyboard.prototype.GetAnnotId = function(){
        if(this._annotid != null){
            return this._annotid;
        }
    };
    r2.PieceKeyboard.prototype.GetPrivateShiftX = function(){
        if(this.__private_shift_x == null){
            if(this.IsOnLeftColumn()){
                this.__private_shift_x = -r2Const.PIECEKEYBOARD_PRIVATE_SHIFT_X;
            }
            else{
                this.__private_shift_x = r2Const.PIECEKEYBOARD_PRIVATE_SHIFT_X;
            }
        }
        return this.__private_shift_x;
    };
    r2.PieceKeyboard.prototype.GetTargetData = function() {
        return {
            type: 'PieceKeyboard',
            pid: this.GetId(),
            aid: this._annotid,
            page: this.GetNumPage()
        };
    };
    r2.PieceKeyboard.prototype.CreateDom = function(){
        this.dom = document.createElement('div');
        this.dom.classList.toggle('r2_piecekeyboard', true);
        this.dom.classList.toggle('unselectable', true);
        this.dom.setAttribute('aria-label', 'text comment');
        this.dom.setAttribute('role', 'article');

        this.dom_tr = document.createElement('div');
        this.dom_tr.classList.toggle('r2_peicekeyboard_tr', true);
        this.dom_tr.classList.toggle('unselectable', true);
        this.dom.appendChild(this.dom_tr);

        this.dom_textbox = document.createElement('div');
        this.dom_textbox.classList.toggle('r2_piecekeyboard_textbox', true);
        this.dom_textbox.classList.toggle('text_selectable', true);
        this.dom_textbox.setAttribute('contenteditable', 'true');
        this.dom_textbox.style.color = r2.userGroup.GetUser(this._username).color_piecekeyboard_text;
        this.dom_tr.appendChild(this.dom_textbox);

        $(this.dom_tr).css('left', this.GetTtIndent()*r2Const.FONT_SIZE_SCALE+'em');
        $(this.dom_tr).css('width', this.GetTtIndentedWidth()*r2Const.FONT_SIZE_SCALE+'em');

        if(this._username != r2.userGroup.cur_user.name){
            this.dom_textbox.setAttribute('contenteditable', 'false');
        }

        /* add event handlers*/
        var func_UpdateSizeWithTextInput = this.UpdateSizeWithTextInput.bind(this);

        this.dom_textbox.addEventListener('input', function() {
            this.__contentschanged = true;
            if(func_UpdateSizeWithTextInput()){
                r2App.invalidate_size = true;
                r2App.invalidate_page_layout = true;
            }
        }.bind(this), false);

        this.dom_textbox.addEventListener('focus', function(event){
            r2App.cur_focused_piece_keyboard = this;
            var color = r2.userGroup.GetUser(this._username).color_piecekeyboard_box_shadow;
            this.dom_textbox.style.boxShadow = "0 0 0.2em "+color+" inset, 0 0 0.2em "+color;
            $(this.dom).css("pointer-events", 'auto');
        }.bind(this));
        r2.keyboard.pieceEventListener.setTextbox(this.dom_textbox);

        this.dom_textbox.addEventListener('blur', function(event){
            // remove cursor complete from the textbox,
            // otherwise it will interfere with mouse interaction for other visaul entities
            window.getSelection().removeAllRanges();

            r2App.cur_focused_piece_keyboard = null;
            this.dom_textbox.style.boxShadow = "none";
            $(this.dom).css("pointer-events", 'none');
            if(this.__contentschanged){
                console.log('>>>>__contentschanged:', this.ExportToTextChange());
                r2Sync.PushToUploadCmd(this.ExportToTextChange());
                this.__contentschanged = false;
            }
        }.bind(this));
        /* add event handlers*/

        this.ResizeDom();

        return this.dom;
    };
    r2.PieceKeyboard.prototype.edit = function(){
        this.dom_textbox.focus();
    };

    r2.PieceKeyboard.prototype.SetPubPrivate = function(isprivate){
        this._isprivate = isprivate;
    };
    r2.PieceKeyboard.prototype.UpdateForPubPrivate = function(){
        if(this._isprivate){
            //$(this.dom_btn_pub).toggleClass("fa-flip-horizontal", r2.util.myXOR(true, this.IsOnLeftColumn()));
        }
        else{
            //$(this.dom_btn_pub).toggleClass("fa-flip-horizontal", r2.util.myXOR(false, this.IsOnLeftColumn()));
        }
    };
    r2.PieceKeyboard.prototype.Relayout = function(){
        this._isvisible = (!this._isprivate || r2.userGroup.cur_user.name == this._username);
        return r2.Piece.prototype.Relayout.apply(this, []);
    };
    r2.PieceKeyboard.prototype.DrawPiece = function(){
        var x_shift = this._isprivate ? this.GetPrivateShiftX() : 0;
        if(!this._isvisible){
            x_shift = -100;
        }

        var x_bgn = this.pos.x + this.GetTtIndent()+x_shift;
        var y_bgn = this.pos.y-r2Const.PIECEAUDIO_LINE_WIDTH;

        if(this._isprivate && this._isvisible){ // private
            r2.canv_ctx.fillStyle = 'dimgray';
            if(x_shift < 0){
                var x = x_bgn+this.GetTtIndentedWidth();
                r2.canv_ctx.fillRect(x,y_bgn,this.pos.x+this._cnt_size.x-x,this._cnt_size.y);
            }
            else{
                r2.canv_ctx.fillRect(this.pos.x,y_bgn,x_bgn-this.pos.x,this._cnt_size.y);
            }
            r2.canv_ctx.fillStyle = 'white';
            r2.canv_ctx.fillRect(this.pos.x+x_shift,y_bgn,this._cnt_size.x,this._cnt_size.y);
        }

        r2.canv_ctx.beginPath();
        r2.canv_ctx.moveTo(x_bgn, y_bgn);
        r2.canv_ctx.lineTo(x_bgn, y_bgn+this._cnt_size.y);
        r2.canv_ctx.moveTo(x_bgn, y_bgn+this._cnt_size.y);
        r2.canv_ctx.lineTo(x_bgn+this.GetTtIndentedWidth(), y_bgn+this._cnt_size.y);

        r2.canv_ctx.strokeStyle = r2.userGroup.GetUser(this._username).color_light_html;
        r2.canv_ctx.lineWidth = r2Const.PIECEAUDIO_LINE_WIDTH;
        r2.canv_ctx.lineCap = 'round';
        r2.canv_ctx.lineJoin = 'round';
        r2.canv_ctx.stroke();
    };

    r2.PieceKeyboard.prototype.DrawSelected = function(canvas_ctx, x_offset){
        if(this._visible) {
            if(typeof x_offset === "undefined"){
                if(this._isprivate){
                    x_offset = this.GetPrivateShiftX();
                }
                else{
                    x_offset = 0;
                }
            }
            r2.Piece.prototype.DrawSelected.apply(this, [canvas_ctx, x_offset]);
        }
    };

    r2.PieceKeyboard.prototype.UpdateSizeWithTextInput = function(){
        var realHeight = function($target){
            var $next = $target.next();
            if($next.length !== 0){
                return $next.offset().top-$target.offset().top;
            }
            else{
                return $target.innerHeight();
            }
        };

        var new_height = r2.viewCtrl.mapDomToDocScale(realHeight($(this.dom)));
        if(this._cnt_size.y != new_height){
            this._cnt_size.y = new_height;
            return true;
        }
        return false;
    };
    r2.PieceKeyboard.prototype.ResizeDom = function(){
        this.UpdateSizeWithTextInput();
    };
    r2.PieceKeyboard.prototype.Focus = function(){
        this.dom_textbox.focus();
    };
    r2.PieceKeyboard.prototype.IsAnnotHasComment = function(annotid, rtn){
        if(this._annotid == annotid){
            rtn.push(this.child.length != 0);
        }
    };
    r2.PieceKeyboard.prototype.SearchPieceByAnnotId = function(annotid){
        var result = r2.Obj.prototype.SearchPieceByAnnotId.apply(this, [annotid]);
        if(result){
            return result;
        }
        else{
            if(this._annotid == annotid){
                return this;
            }
            else{
                return null;
            }
        }
    };

    /*
     * Annot
     */
    r2.Annot = function(){
        this._id = null;
        this._anchorpid = null;
        this._bgn_time = 0;
        this._duration = 0;
        this._audio_dbs = [];
        this._username = null;
        this._spotlights = [];
        this._inks = [];
        this._audiofileurl = "";
        this._is_base_annot = false;
    };

    r2.Annot.prototype.ExportToCmd = function(){
        // time: 2014-12-21T13...
        // user: 'red user'
        // op: 'CreateComment'
        // type: CommentAudio
        // anchorTo: {type: 'PieceText', id: pid, page: 2} or
        //           {type: 'PieceTeared', id: pid, page: 2}
        //           {type: 'CommentAudio', id: annotId, page: 2, time: [t0, t1]}
        // data: {aid: ..., duration: t, waveform_sample: [0, 100, 99, 98 ...], Spotlights: [Spotlight, Spotlight, ...] };
        var cmd = {};
        cmd.time = new Date(this._bgn_time).toISOString();
        cmd.user = this._username;
        cmd.op = 'CreateComment';
        cmd.type = 'CommentAudio';
        cmd.anchorTo = r2App.pieces_cache[this._anchorpid].GetAnchorTo();
        cmd.data = {};
        cmd.data.aid = this._id;
        cmd.data.duration = this._duration;
        cmd.data.waveform_sample = this._audio_dbs;
        cmd.data.Spotlights = [];
        this._spotlights.forEach(function(splght){
            cmd.data.Spotlights.push(splght.ExportToCmd());
        });
        cmd.data.Inks = [];
        this._inks.forEach(function(ink){
            cmd.data.Inks.push(ink.ExportToCmd());
        });
        cmd.data.audiofileurl = this._audiofileurl;
        return cmd;
    };
    r2.Annot.prototype.setIsBaseAnnot = function(){
        this._is_base_annot = true;
    };
    r2.Annot.prototype.getIsBaseAnnot = function(){
        return this._is_base_annot;
    };
    r2.Annot.prototype.ExportToCmdDeleteComment = function(){
        // time: 2014-12-21T13...
        // user: 'red user'
        // op: 'DeleteComment'
        // target: {type: 'PieceKeyboard', pid: pid, page: 2}
        var cmd = {};
        cmd.time = (new Date()).toISOString();
        cmd.user = this._username;
        cmd.op = "DeleteComment";
        cmd.target = this.GetTargetData();
        return cmd;
    };
    r2.Annot.prototype.GetTargetData = function(){
        return {
            type: 'CommentAudio',
            aid: this._id,
            page: r2App.pieces_cache[this._anchorpid].GetNumPage()
        };
    };
    r2.Annot.prototype.GetDuration = function(){
        return this._duration;
    };
    r2.Annot.prototype.GetId = function(){
        return this._id;
    };
    r2.Annot.prototype.GetAnchorPid = function(){
        return this._anchorpid;
    };
    r2.Annot.prototype.GetAnnotId = r2.Annot.prototype.GetId;
    r2.Annot.prototype.GetBgnTime = function(){
        return this._bgn_time;
    };
    r2.Annot.prototype.GetRecordingAudioBlob = function(){
        return this._reacordingaudioblob;
    };
    r2.Annot.prototype.GetSpotlightsByNumPage = function(n){
        return this._spotlights.filter(function(spotlight){return spotlight.GetPage() == n;})
    };
    r2.Annot.prototype.GetInksByNumPage = function(n){
        return this._inks.filter(function(Ink){return Ink.GetPage() == n;})
    };
    r2.Annot.prototype.GetUser = function(){
        return r2.userGroup.GetUser(this._username);
    };
    r2.Annot.prototype.GetUsername = function(){
        return this._username;
    };
    r2.Annot.prototype.SetAnnot = function(id, anchorpid, t_bgn, duration, audio_dbs, username, audiofileurl){
        this._id = id;
        this._anchorpid = anchorpid;
        this._bgn_time = t_bgn;
        this._duration = duration;
        this._audio_dbs = audio_dbs;
        this._username = username;

        this._audiofileurl = audiofileurl;
        this._reacordingaudioblob = null;
    };
    r2.Annot.prototype.AddSpotlight = function(spotlight, toupload){
        this._spotlights.push(spotlight);
    };
    r2.Annot.prototype.addInk = function(ink, toupload){
        if(ink.segments.length>0){
            this._inks.push(ink);
        }
    };
    r2.Annot.prototype.detachInk = function(ink){
        var idx = this._inks.indexOf(ink);
        if(idx > -1){
            this._inks.splice(idx, 1);
        }
    };
    r2.Annot.prototype.GetAudioFileUrl = function(){
        return r2.util.normalizeUrl(this._audiofileurl);
    };
    r2.Annot.prototype.SetRecordingAudioFileUrl = function(url, blob, buffer){
        //url = 'https://newspeak-tts.mybluemix.net/synthesize?text=The+greatest+teacher+is+experience.+It+is+only+through+first+hand+experience,+that+any+new+knowledge+can+get+fixed+in+the+mind.&voice=en-US_MichaelVoice';
        console.log("Annot URL set to ", url);
        this._audiofileurl = url;
        this._reacordingaudioblob = blob;

        if(buffer){
            var view = new DataView(buffer);
            var l = [];
            for(var i = 44; i < buffer.byteLength; i+=2){
                var v = view.getInt16(i, true);
                l.push(v);
            }

            this._duration = 1000*l.length/r2.audioRecorder.RECORDER_SAMPLE_RATE;

            var samples_per_sec = 256;
            var n_chunk = Math.floor(r2.audioRecorder.RECORDER_SAMPLE_RATE/samples_per_sec+0.5); // 32 power samples per sec
            this._audio_dbs = [];
            for(var i = 0, d = Math.floor(l.length/n_chunk); i < d; ++i){
                this._audio_dbs.push(r2.util.rootMeanSquare(l, n_chunk*i, n_chunk*(i+1)));
            }

            var min = 0.0;
            var max = 0.2;
            this._audio_dbs.forEach(function(v){
                min = Math.min(min, v);
                max = Math.max(max, v);
            });
            for(var i = 0; i < this._audio_dbs.length; ++i){
                this._audio_dbs[i] = (this._audio_dbs[i]-min)/(max-min);
            }

        }
    };

    r2.Annot.prototype.SampleAudioDbs = function(msec) {
        var x = this._audio_dbs.length*(msec/this._duration);
        var p = x-Math.floor(x);
        var v0 = (1.0-p)*this._audio_dbs[Math.max(0, Math.min(this._audio_dbs.length-1, Math.floor(x)))];
        var v1 = p*this._audio_dbs[Math.max(0, Math.min(this._audio_dbs.length-1, Math.floor(x)+1))];
        return v0+v1;
    };
    r2.Annot.prototype.UpdateDbs = function(dbs){
        this._duration = r2App.cur_time-this._bgn_time;

        var dbsPerSec = r2.audioRecorder.RECORDER_POWER_SAMPLE_PER_SEC;
        var nDbs = Math.floor((r2App.cur_time-this._bgn_time) * dbsPerSec);

        for(var i = this._audio_dbs.length; i < nDbs; ++i) {
            this._audio_dbs.push((r2.audioRecorder.RECORDER_SAMPLE_SCALE*dbs).toFixed(3));
        }
    };


    /* abstract annot that contains private spotlights */
    r2.AnnotPrivateSpotlight = function() {
        r2.Annot.call(this);
        this.timeLastChanged = 0;
        this.changed = false;
        this._spotlightsDictionary = {};
        this._spotlightsToUpload = [];
    };
    r2.AnnotPrivateSpotlight.prototype = Object.create(r2.Annot.prototype);
    r2.AnnotPrivateSpotlight.prototype.ExportToCmd = function(){
        // time: 2014-12-21T13...
        // user: 'red user'
        // op: 'CreateComment'
        // type: PrivateHighlight
        // data: {Spotlights: [Spotlight, Spotlight, ...] };
        var cmd ={};
        cmd.time = new Date(this.timeLastChanged).toISOString();
        cmd.user = r2.userGroup.cur_user.name;
        cmd.op = "CreateComment";
        cmd.type = "PrivateHighlight";
        cmd.data = {};
        cmd.data.Spotlights = [];
        this._spotlightsToUpload.forEach(function(splght){
            cmd.data.Spotlights.push(splght.ExportToCmd());
        });
        this._spotlightsToUpload = [];
        return cmd;
    };
    r2.AnnotPrivateSpotlight.prototype.AddSpotlight = function(spotlight, toupload){
        if(spotlight.time in this._spotlightsDictionary){return;}
        this._spotlights.push(spotlight);
        this._spotlightsDictionary[spotlight.time] = true;
        if(toupload){
            this._spotlightsToUpload.push(spotlight);
        }
    };
    r2.AnnotPrivateSpotlight.prototype.getCmdsToUpload = function(){
        if( this.changed &&
            r2App.cur_time-this.timeLastChanged > r2Const.TIMEOUT_PRIVATE_HIGHLIGHT_UPDATE){

            this.changed = false;
            return this.ExportToCmd();
        }
        else{
            return null;
        }
    };

    /* abstract annot that contains static inks */
    r2.AnnotStaticInk = function(){
        r2.Annot.call(this);
        this.inks_dict = {};
        this.add_ink_cmd_uploader = new r2.CmdTimedUploader();
        this.add_ink_cmd_uploader.init(r2Const.TIMEOUT_STATIC_INK_UPDATE);
    };
    r2.AnnotStaticInk.prototype = Object.create(r2.Annot.prototype);
    r2.AnnotStaticInk.prototype.addInk = function(ink, to_upload){
        if(ink._t_bgn in this.inks_dict){return;}

        this._inks.push(ink);
        this.inks_dict[ink._t_bgn] = true;

        if(to_upload){
            this.add_ink_cmd_uploader.addCmd(ink.ExportToCmd());
        }
    };
    r2.AnnotStaticInk.prototype.getCmdsToUpload = function(){
        // time: 2014-12-21T13...
        // user: 'red user'
        // op: 'CreateComment'
        // type: 'StaticInk'
        // data: {inks: [Ink, Ink, ...] };
        var ink_cmds = this.add_ink_cmd_uploader.getCmdsToUpload();
        if(ink_cmds){
            var cmd ={};
            cmd.time = new Date(ink_cmds.time).toISOString();
            cmd.user = r2.userGroup.cur_user.name;
            cmd.op = "CreateComment";
            cmd.type = "StaticInk";
            cmd.data = {};
            cmd.data.inks = ink_cmds.cmds;
            return cmd;
        }
        return null;
    };
    r2.AnnotStaticInk.prototype.checkCmdToUploadExist = function(){
        return this.add_ink_cmd_uploader.checkCmdToUploadExist();
    };

    /*
     * Ink
     */
    r2.Ink = function(){
        this._username = '';
        this._annotid = null;
        this._t_bgn = 0;
        this._t_end = 0;
        this.npage = 0;
        this._pid = '';
        this.segments = [];
    };
    r2.Ink.prototype.SetInk = function(pid, username, annotid, t_bgn_and_end, npage){
        this._pid = pid;
        this._username = username;

        this._annotid = annotid !== '' ?
            annotid :
            r2.userGroup.GetUser(this._username).GetAnnotStaticInkId();
        this._t_bgn = t_bgn_and_end[0];
        this._t_end = t_bgn_and_end[1];
        this.npage = npage;
    };
    r2.Ink.prototype.erase = function(to_upload){
        var piece = r2App.pieces_cache[this._pid];
        var annot = this._annotid === '' ?
            r2App.annots[r2.userGroup.GetUser(this._username).GetAnnotStaticInkId()] :
            r2App.annots[this._annotid];

        piece.detachInk(this);
        annot.detachInk(this);
        if(to_upload){
            return this.exportToDeleteComment();
        }
        return null;
    };
    r2.Ink.prototype.exportToDeleteComment = function(){
        // time: 2014-12-21T13...
        // user: 'red user'
        // op: 'DeleteComment'
        // type: 'Ink'
        // target: {pid: pid, page: 2, aid: annotid, t_bgn: <time>}
        var cmd = {};
        cmd.time = (new Date()).toISOString();
        cmd.target = {
            pid: this._pid,
            aid: this._annotid,
            t_bgn: this._t_bgn
        };
        return cmd;
    };
    r2.Ink.prototype.GetPage = function(){
        return this.npage;
    };
    r2.Ink.prototype.getTimeBgn = function(){
        return this._t_bgn;
    };
    r2.Ink.prototype.getUsername = function(){
        return this._username;
    };
    r2.Ink.prototype.ExportToCmd = function(){
        //Ink: {_username: ..., _annotid:..., t_bgn:..., t_end:..., npage: 0, segments: [Segment, Segment, ...]}
        var cmd = {};
        cmd.username = this._username;
        cmd.annotid = this._annotid;
        cmd.pid = this._pid;
        cmd.t_bgn = this._t_bgn;
        cmd.t_end = this._t_end;
        cmd.npage = this.npage;
        cmd.segments = [];
        this.segments.forEach(function(sgmnt){
            cmd.segments.push(sgmnt.ExportToCmd());
        });

        return cmd;
    };
    r2.Ink.prototype.Relayout = function(piece_pos){
    };
    r2.Ink.prototype.Draw = function(){
        this.DrawSegments(r2.canv_ctx);
    };

    r2.Ink.prototype.drawReplaying = function(canvas_ctx){
        var numall=0;
        for (i = 0; segment = this.segments[i]; ++i) {
            numall = numall+segment._pts.length;
        }
        if(r2App.cur_annot_id != null && r2App.cur_annot_id === this._annotid) {
            var n = Math.floor(numall * (r2App.cur_audio_time - this._t_bgn) / (this._t_end - this._t_bgn));
            n = Math.min(numall, n);
            var curn=0;
            if (n >= 2) {
                canvas_ctx.beginPath();
                var i, segment;
                var wasbgn = false;
                for (i = 0; segment = this.segments[i]; ++i) {
                    if(n<curn){
                        break;
                    }
                    wasbgn = segment.drawReplaying(canvas_ctx, wasbgn, n-curn);
                    curn=curn+segment._pts.length;

                }
                canvas_ctx.strokeStyle = r2.userGroup.GetUser(this._username).color_stroke_dynamic_past;
                canvas_ctx.lineWidth = r2Const.INK_WIDTH * 3;
                canvas_ctx.lineCap = 'round';
                canvas_ctx.lineJoin = 'round';
                canvas_ctx.stroke();
            }
        }
    };
    r2.Ink.prototype.AddSegment = function(segment){
        this.segments.push(segment);
    };
    r2.Ink.prototype.getValidSegments = function(){
        var rtn = [];
        var i, segment;
        for(i = 0; segment = this.segments[i]; ++i){
            if(r2App.pieces_cache.hasOwnProperty(segment.GetPieceId())){
                rtn.push(segment);
            }
        }
        return rtn;
    };
    r2.Ink.prototype.DrawSegments = function(canvas_ctx){
        canvas_ctx.beginPath();
        var i, segment;
        var wasbgn = false;
        for(i = 0; segment = this.segments[i]; ++i){
            wasbgn = segment.Draw(canvas_ctx, wasbgn);
        }
        if(r2App.cur_annot_id != null && r2App.cur_annot_id == this._annotid) {
            canvas_ctx.strokeStyle = r2.userGroup.GetUser(this._username).color_stroke_dynamic_future;
        }
        else{
            canvas_ctx.strokeStyle = r2.userGroup.GetUser(this._username).color_dark_html;
        }
        canvas_ctx.lineWidth = r2Const.INK_WIDTH;
        canvas_ctx.lineCap = 'round';
        canvas_ctx.lineJoin = 'round';
        canvas_ctx.stroke();
    };
    r2.Ink.prototype.smoothing = function(canvas_ctx){
        var i, segment;
        for(i = 0; segment = this.segments[i]; ++i) {
            segment.smoothing();
        }
    };
    r2.Ink.prototype.dist = function(pt){
        var min_dist = Number.POSITIVE_INFINITY;
        var i, segment;
        for(i = 0; segment = this.segments[i]; ++i) {
            min_dist = Math.min(min_dist, segment.dist(pt));
        }
        return min_dist;
    };

    /*
    ink segment
     */
    r2.Ink.Segment = function(){
        this._pid = null;
        this._pts = [];
    };
    r2.Ink.Segment.prototype.ExportToCmd = function(){
        //Ink.Segment: {pid: ..., pts: [Vec2, Vec2, ...]}
        var cmd = {};
        cmd.pid = this._pid;
        cmd.pts = r2.util.vec2ListToNumList(this._pts);
        return cmd;
    };
    r2.Ink.Segment.prototype.GetPieceId = function(){
        return this._pid;
    };
    r2.Ink.Segment.prototype.GetNumPts = function(){
        return this._pts.length;
    };
    r2.Ink.Segment.prototype.SetSegment = function(pid, pts){
        this._pid = pid;
        this._pts = pts;
    };
    r2.Ink.Segment.prototype.CopyPtsWithOffset = function(offset){
        var rtn = new Array(this._pts.length);
        for(var i = 0; i < this._pts.length; ++i){
            rtn[i] = new Vec2(this._pts[i].x+offset.x, this._pts[i].y + offset.y);
        }
        return rtn;
    };
    r2.Ink.Segment.prototype.AddPt = function(pt){
        this._pts.push(pt);
    };
    r2.Ink.Segment.prototype.Draw = function(canvas_ctx, wasbgn){
        //
        var piece = r2App.pieces_cache[this._pid];
        if(piece){
            var offset = piece.pos;
            for(var i = 0; i < this._pts.length; ++i) {
                if(wasbgn){
                    canvas_ctx.lineTo(offset.x+this._pts[i].x, offset.y+this._pts[i].y);
                }
                else{
                    canvas_ctx.moveTo(offset.x+this._pts[i].x, offset.y+this._pts[i].y);
                    wasbgn = true;
                }
            }
        }
        return wasbgn;
    };
    r2.Ink.Segment.prototype.smoothing = function(){
        this._pts = r2.util.SimplifyStrokeDouglasPuecker(this._pts,0,this._pts.length, 0.001);
    };
    r2.Ink.Segment.prototype.drawReplaying = function(canvas_ctx,wasbgn,cnt){

        var piece = r2App.pieces_cache[this._pid];
        cnt=Math.min(cnt,this._pts.length);
        if(piece){
            var offset = piece.pos;
            for(var i = 0; i < cnt; ++i) {
                if(wasbgn){
                    canvas_ctx.lineTo(offset.x+this._pts[i].x, offset.y+this._pts[i].y);
                }
                else{
                    canvas_ctx.moveTo(offset.x+this._pts[i].x, offset.y+this._pts[i].y);
                    wasbgn = true;
                }
            }
        }
        return wasbgn;
    };
    r2.Ink.Segment.prototype.dist = function(pt){
        var min_dist = Number.POSITIVE_INFINITY;
        var i, l;
        for(i = 0, l = this._pts.length; i < l; ++i) {
            min_dist = Math.min(min_dist, pt.distance(this._pts[i]));
        }
        return min_dist;
    };
    /*
      ink cache
     */
    r2.Ink.Cache = function(){
        this._annot = null;
        this._t_bgn = 0;
        this._t_end = 0;
        this._pts = [];
    };
    r2.Ink.Cache.prototype.setCache = function(annot, t_bgn, t_end, pts){
        this._annot = annot;
        this._t_bgn = t_bgn;
        this._t_end = t_end;
        this._pts = pts;

        this._user = this._annot.GetUser();
    };
    r2.Ink.Cache.prototype.preRender = function(ctx){
        if(this._pts.length == 0){return;}

        ctx.beginPath();
        ctx.moveTo(this._pts[0].x, this._pts[0].y);
        for(var i = 0; i < this._pts.length; ++i) {
            ctx.lineTo(this._pts[i].x, this._pts[i].y);
        }
        ctx.strokeStyle = this._user.color_stroke_dynamic_past;
        ctx.lineWidth = r2Const.INK_WIDTH;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    };


    r2.Ink.Cache.prototype.GetPlayback = function(pt) {
        if(this._pts.length>1 && this._annot != null && this._t_end > this._t_bgn){
            for(var i = 0; i < this._pts.length-1; ++i){
                if(r2.util.linePointDistance(this._pts[i], this._pts[i+1], pt) < r2Const.SPLGHT_WIDTH/2){
                    var rtn = {};
                    rtn.annot = this._annot.GetId();
                    rtn.t = this._t_bgn + (i/this._pts.length)*(this._t_end-this._t_bgn);
                    return rtn;
                }
            }
        }
        return null;
    };

    /*
     * Spotlight
     */
    // Spotlight: {t_bgn:..., t_end:..., npage: 0, segments: [Segment, Segment, ...]}
    // Spotlight.Segment: {pid: ..., pts: [Vec2, Vec2, ...]}

    r2.Spotlight = function(){
        this.username = null;
        this.annotid = null;
        this.npage = 0;
        this.time = 0;
        this.t_bgn = 0;
        this.t_end = 0;

        this.segments = [];
    };
    r2.Spotlight.prototype.ExportToCmd = function(){
        //Spotlight: {t_bgn:..., t_end:..., npage: 0, segments: [Segment, Segment, ...]}
        var cmd = {};
        cmd.time = this.time;
        cmd.t_bgn = this.t_bgn;
        cmd.t_end = this.t_end;
        cmd.npage = this.npage;
        cmd.segments = [];
        this.segments.forEach(function(sgmnt){
            cmd.segments.push(sgmnt.ExportToCmd());
        });
        return cmd;
    };
    r2.Spotlight.prototype.GetPage = function(){
        return this.npage;
    };
    r2.Spotlight.prototype.SetSpotlight = function(username, annotid, npage, time, t_bgn, t_end){
        this.username = username;
        this.annotid = annotid;
        this.npage = npage;
        this.time = time;
        this.t_bgn = t_bgn;
        this.t_end = t_end;
    };
    r2.Spotlight.prototype.AddSegment = function(segment){
        this.segments.push(segment);
    };
    r2.Spotlight.prototype.getValidSegments = function(){
        var rtn = [];
        var i, segment;
        for(i = 0; segment = this.segments[i]; ++i){
            if(r2App.pieces_cache.hasOwnProperty(segment.GetPieceId())){
                rtn.push(segment);
            }
        }
        return rtn;
    };
    r2.Spotlight.prototype.Draw = function(canvas_ctx){
        canvas_ctx.beginPath();
        var i, segment;
        var wasbgn = false;
        for(i = 0; segment = this.segments[i]; ++i){
            wasbgn = segment.Draw(canvas_ctx, wasbgn);
        }

        var color;
        var width;
        color = r2.userGroup.GetUser(this.username).color_splight_static;
        width = r2Const.SPLGHT_WIDTH;
        canvas_ctx.strokeStyle = color;
        canvas_ctx.lineWidth = width;
        canvas_ctx.lineCap = 'round';
        canvas_ctx.lineJoin = 'round';
        canvas_ctx.stroke();
    };
    r2.Spotlight.prototype.Retarget = function(annotid, t_bgn, t_end){
        var rtn = jQuery.extend({}, this);
        rtn.annotid = annotid;
        rtn.t_bgn = t_bgn;
        rtn.t_end = t_end;
        return rtn;
    };

    /*
     * Spotlight.Segment
     */
    r2.Spotlight.Segment = function(){
        this._pid = null;
        this._pts = [];
    };
    r2.Spotlight.Segment.prototype.ExportToCmd = function(){
        //Spotlight.Segment: {pid: ..., pts: [Vec2, Vec2, ...]}
        var cmd = {};
        cmd.pid = this._pid;
        cmd.pts = r2.util.vec2ListToNumList(this._pts);
        return cmd;
    };
    r2.Spotlight.Segment.prototype.GetPieceId = function(){
        return this._pid;
    };
    r2.Spotlight.Segment.prototype.GetNumPts = function(){
        return this._pts.length;
    };
    r2.Spotlight.Segment.prototype.SetSegment = function(pid, pts){
        this._pid = pid;
        this._pts = pts;
    };
    r2.Spotlight.Segment.prototype.CopyPtsWithOffset = function(offset){
        var rtn = new Array(this._pts.length);
        for(var i = 0; i < this._pts.length; ++i){
            rtn[i] = new Vec2(this._pts[i].x+offset.x, this._pts[i].y + offset.y);
        }
        return rtn;
    };
    r2.Spotlight.Segment.prototype.AddPt = function(pt){
        this._pts.push(pt);
    };
    r2.Spotlight.Segment.prototype.Draw = function(canvas_ctx, wasbgn){
        var piece = r2App.pieces_cache[this._pid];
        if(piece){
            var offset = piece.pos;
            for(var i = 0; i < this._pts.length; ++i) {
                if(wasbgn){
                    canvas_ctx.lineTo(offset.x+this._pts[i].x, offset.y+this._pts[i].y);
                }
                else{
                    canvas_ctx.moveTo(offset.x+this._pts[i].x, offset.y+this._pts[i].y);
                    wasbgn = true;
                }

            }
        }
        return wasbgn;
    };


    /*
     * Spotlight.Cache
     */
    r2.Spotlight.Cache = function(){
        this._annot = null;
        this._t_bgn = 0;
        this._t_end = 0;
        this._pts = [];
        this._bb = [];
    };
    r2.Spotlight.Cache.prototype.setCache = function(annot, t_bgn, t_end, pts){
        this._annot = annot;
        this._t_bgn = t_bgn;
        this._t_end = t_end;
        this._pts = pts;

        this._user = this._annot.GetUser();
        var max = new Vec2(Number.MIN_VALUE, Number.MIN_VALUE);
        var min = new Vec2(Number.MAX_VALUE, Number.MAX_VALUE);
        for(var i = 0; i < this._pts.length; ++i){
            var v = this._pts[i];
            max.x = Math.max(max.x, v.x);
            max.y = Math.max(max.y, v.y);
            min.x = Math.min(min.x, v.x);
            min.y = Math.min(min.y, v.y);
        }
        max.x+=r2Const.SPLGHT_WIDTH/2;max.y+=r2Const.SPLGHT_WIDTH/2;
        min.x-=r2Const.SPLGHT_WIDTH/2;min.y-=r2Const.SPLGHT_WIDTH/2;
        this._bb = [min, max];
    };
    r2.Spotlight.Cache.prototype.preRender = function(ctx, ratio){
        if(this._pts.length == 0){return;}

        ctx.beginPath();
        ctx.moveTo(this._pts[0].x*ratio, this._pts[0].y*ratio);
        for(var i = 0; i < this._pts.length; ++i) {
            ctx.lineTo(this._pts[i].x*ratio, this._pts[i].y*ratio);
        }

        var color;
        var width;
        color = this._user.color_splight_static;
        width = Math.floor(r2Const.SPLGHT_WIDTH*ratio);

        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    };
    r2.Spotlight.Cache.prototype.drawReplayBlob = function(canvas_ctx){
        if(this._annot.GetId() === r2App.cur_annot_id){
            if(this._pts.length &&
                r2App.cur_audio_time > this._t_bgn &&
                r2App.cur_audio_time < this._t_end){

                var idx = (this._pts.length-2)*(r2App.cur_audio_time-this._t_bgn)/(this._t_end-this._t_bgn)+0.25;
                idx = Math.max(0, Math.min(this._pts.length-2, Math.floor(idx)));

                var p0 = this._pts[idx];
                var p1;
                if(this._pts.length-1 == idx){
                    p1 = p0;
                }
                else{
                    p1 = this._pts[idx+1];
                }
                this.drawMovingBlob(
                    p0,
                    p1,
                    false,  // forprivate
                    this._user.color_splight_dynamic,  // color,
                    canvas_ctx
                );
            }
        }
    };
    r2.Spotlight.Cache.prototype.drawMovingBlob = function(p0, p1, forprivate, color, canvas_ctx){
        var line_width = 0;
        if(forprivate){
            line_width = r2Const.SPLGHT_PRIVATE_WIDTH;
        }
        else{
            line_width = r2Const.SPLGHT_WIDTH;
        }
        if(p0.distance(p1) < 0.02){
            canvas_ctx.beginPath();
            canvas_ctx.arc(p0.x, p0.y, line_width*0.5, 0, 2 * Math.PI, false);
            canvas_ctx.fillStyle = color;
            canvas_ctx.fill();
        }
        else{
            canvas_ctx.beginPath();
            canvas_ctx.moveTo(p0.x, p0.y);
            canvas_ctx.lineTo(p1.x, p1.y);

            canvas_ctx.lineWidth = line_width;
            canvas_ctx.strokeStyle = color;
            canvas_ctx.lineCap = 'round';
            canvas_ctx.lineJoin = 'round';
            canvas_ctx.stroke();
        }
    };
    r2.Spotlight.Cache.prototype.HitTest = function(pt){
        if( pt.x > this._bb[0].x && pt.y > this._bb[0].y &&
            pt.x < this._bb[1].x && pt.y < this._bb[1].y){
            return this;
        }
        else{
            return null;
        }
    };
    r2.Spotlight.Cache.prototype.GetPlayback = function(pt) {
        if(this._pts.length>1 && this._annot != null && this._t_end > this._t_bgn){
            for(var i = 0; i < this._pts.length-1; ++i){
                if(r2.util.linePointDistance(this._pts[i], this._pts[i+1], pt) < r2Const.SPLGHT_WIDTH/2){
                    var rtn = {};
                    rtn.annot = this._annot.GetId();
                    rtn.t = this._t_bgn + (i/this._pts.length)*(this._t_end-this._t_bgn);
                    return rtn;
                }
            }
        }
        return null;
    };

}(window.r2 = window.r2 || {}));
