/* IB.ChartTheme — one chart theme for every app (T9). Reads the --ib-* tokens at render time, so both themes and per-event
   brands work and nothing is hard-coded: no hex, no slate greys, no index palette.
   Works with ECharts (option fragments) and with plain SVG/canvas (tokens()).

   const t = IB.ChartTheme.tokens(chartEl);               // resolved to rgb(), safe for zrender / canvas
   chart.setOption(IB.ChartTheme.echarts(chartEl, {legend:true, timeAxis:true}));
   chart.setOption({series:[IB.ChartTheme.lineSeries(chartEl,'Команда A',data,{own:true})]});
   const stop = IB.ChartTheme.watch(chartEl, () => render());   // re-render when data-theme changes; call stop() on unmount

   Rules baked in (guidelines/charts.md):
   - text: Geist; axis labels 12px (--ib-chart-fs-axis), legend 13px (--ib-chart-fs-legend), colours --ib-chart-axis / --ib-chart-legend
   - grid --ib-chart-grid, axis line --ib-chart-line; palette --ib-s1…s10 (fixed by entity, never by rank), own team --ib-s-own
   - lines are smooth monotone (never overshoot), 2px (own team 3px), no symbols except a single point; a second cue besides colour:
     dashed (index % 3), distinct symbol on request (symbols:true), direct end labels are the preferred cue
   - animation off under prefers-reduced-motion; tooltip is a raised surface with a hairline (same as .ib-tip__bubble)
   - wheel zoom only with Ctrl (dataZoom zoomOnMouseWheel:'ctrl'); the canvas gets role="img" + aria-label (a data table is the text alternative) */
(function(){
  var IB=window.IB=window.IB||{};
  var SERIES=['--ib-s1','--ib-s2','--ib-s3','--ib-s4','--ib-s5','--ib-s6','--ib-s7','--ib-s8','--ib-s9','--ib-s10'];
  var canvas=null;

  function norm(css){   /* any CSS colour (color-mix, color(srgb …), var result) → rgb()/rgba() */
    try{
      canvas=canvas||document.createElement('canvas');canvas.width=canvas.height=1;
      var c=canvas.getContext('2d',{willReadFrequently:true});c.clearRect(0,0,1,1);c.fillStyle='#000';c.fillStyle=css;c.fillRect(0,0,1,1);
      var d=c.getImageData(0,0,1,1).data;
      return d[3]===255?'rgb('+d[0]+', '+d[1]+', '+d[2]+')':'rgba('+d[0]+', '+d[1]+', '+d[2]+', '+(d[3]/255).toFixed(3)+')';
    }catch(e){return css}
  }
  function color(el,token){
    var probe=document.createElement('span');probe.style.cssText='position:absolute;visibility:hidden;pointer-events:none;color:var('+token+')';
    el.appendChild(probe);var v=getComputedStyle(probe).color;el.removeChild(probe);return norm(v);
  }
  function px(el,token,fallback){var n=parseFloat(getComputedStyle(el).getPropertyValue(token));return isNaN(n)?fallback:n}
  function reduced(){return !!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)}

  var T=IB.ChartTheme={
    tokens:function(el){
      el=el||document.documentElement;
      var cs=getComputedStyle(el);
      return {
        font:(cs.getPropertyValue('--ib-font')||'Geist, system-ui, sans-serif').trim(),
        fsAxis:px(el,'--ib-chart-fs-axis',12),fsLegend:px(el,'--ib-chart-fs-legend',13),lineWidth:px(el,'--ib-chart-lw',2),
        axis:color(el,'--ib-chart-axis'),legend:color(el,'--ib-chart-legend'),grid:color(el,'--ib-chart-grid'),line:color(el,'--ib-chart-line'),
        ink:color(el,'--ib-ink'),surface:color(el,'--ib-surface'),raised:color(el,'--ib-tip-bg'),tipLine:color(el,'--ib-tip-line'),
        own:color(el,'--ib-s-own'),other:color(el,'--ib-s-other'),
        series:SERIES.map(function(s){return color(el,s)}),reducedMotion:reduced()
      };
    },
    /* base ECharts option: text, axes, grid, legend, tooltip, animation. Merge your series on top. */
    echarts:function(el,o){
      o=o||{};var t=T.tokens(el);
      var axisCommon={axisLine:{lineStyle:{color:t.line}},axisTick:{lineStyle:{color:t.line}},axisLabel:{color:t.axis,fontSize:t.fsAxis,fontFamily:t.font,hideOverlap:true},
        splitLine:{lineStyle:{color:t.grid}},nameTextStyle:{color:t.axis,fontSize:t.fsAxis,fontFamily:t.font}};
      var opt={
        color:t.series,backgroundColor:'transparent',animation:!t.reducedMotion,
        textStyle:{fontFamily:t.font,fontSize:t.fsAxis,color:t.axis},
        grid:{left:8,right:16,top:o.legend?40:16,bottom:8,containLabel:true},
        xAxis:Object.assign({type:o.timeAxis?'time':'category'},axisCommon),
        yAxis:Object.assign({type:'value',minInterval:o.minInterval},axisCommon),
        tooltip:{trigger:'axis',backgroundColor:t.raised,borderColor:t.tipLine,borderWidth:1,textStyle:{color:t.ink,fontSize:13,fontFamily:t.font},extraCssText:'box-shadow:none;border-radius:6px'},
        legend:o.legend?{type:'plain',top:0,left:0,itemWidth:16,itemHeight:2,textStyle:{color:t.legend,fontSize:t.fsLegend,fontFamily:t.font}}:undefined,
        dataZoom:o.zoom?[{type:'inside',zoomOnMouseWheel:'ctrl',moveOnMouseMove:true}]:undefined
      };
      return opt;
    },
    /* one smooth monotone line. extra.own = the viewer's team (accent colour); extra.index picks the palette slot and dash cue. */
    lineSeries:function(el,name,data,extra){
      extra=extra||{};var t=T.tokens(el),i=extra.index||0;
      var c=extra.color||(extra.own?t.own:(extra.index===undefined?t.other:t.series[i%t.series.length]));
      var single=Array.isArray(data)&&data.length===1;
      return Object.assign({
        type:'line',name:name,data:data,smooth:true,smoothMonotone:'x',
        symbol:single?'circle':(extra.symbols?['circle','rect','triangle','diamond'][i%4]:'none'),symbolSize:single?8:6,showSymbol:single||!!extra.symbols,
        lineStyle:{width:extra.own?t.lineWidth+1:t.lineWidth,color:c,type:extra.own?'solid':['solid','dashed','dotted'][i%3]},itemStyle:{color:c},emphasis:{focus:'series'},
        endLabel:extra.endLabel?{show:true,color:t.ink,fontSize:t.fsAxis,fontFamily:t.font,formatter:'{a}'}:undefined
      },extra.series||{});
    },
    /* a11y wrapper for the canvas host: role=img + short label; point at a table for the data */
    describe:function(host,label,tableId){host.setAttribute('role','img');host.setAttribute('aria-label',label);if(tableId)host.setAttribute('aria-describedby',tableId)},
    /* re-render on theme change (data-theme on any ancestor, brand custom properties on <html>) */
    watch:function(el,cb){
      var obs=new MutationObserver(function(){cb()});
      for(var n=el;n&&n.nodeType===1;n=n.parentElement)obs.observe(n,{attributes:true,attributeFilter:['data-theme','style','class']});
      return function(){obs.disconnect()};
    }
  };
})();
