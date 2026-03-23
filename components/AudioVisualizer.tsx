
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyser, isPlaying }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<d3.Selection<SVGPathElement, unknown, null, undefined> | null>(null);
  const areaRef = useRef<d3.Area<number> | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // Setup effect: runs only when analyser changes — builds gradient, scales, path once
  useEffect(() => {
    if (!svgRef.current || !analyser) {
      pathRef.current = null;
      return;
    }

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const bufferLength = analyser.frequencyBinCount;
    dataArrayRef.current = new Uint8Array(bufferLength);

    const x = d3.scaleLinear().domain([0, bufferLength]).range([0, width]);

    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'wave-gradient')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '0%');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#f97316');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#1e1b4b');

    areaRef.current = d3.area<number>()
      .x((_, i) => x(i))
      .y0(height / 2)
      .y1(d => (height / 2) + (d / 4))
      .curve(d3.curveBasis);

    pathRef.current = svg.append('path')
      .attr('fill', 'url(#wave-gradient)')
      .attr('stroke', 'rgba(30, 27, 75, 0.2)')
      .attr('stroke-width', 1);

    // Show flat line when not playing
    pathRef.current.attr('d', areaRef.current(new Array(bufferLength).fill(0)));
  }, [analyser]);

  // Animation effect: starts/stops the rAF loop when isPlaying changes
  useEffect(() => {
    if (!analyser || !pathRef.current || !areaRef.current || !dataArrayRef.current) return;
    if (!isPlaying) {
      pathRef.current.attr('d', areaRef.current(new Array(dataArrayRef.current.length).fill(0)));
      return;
    }

    let animationId: number;
    const update = () => {
      analyser.getByteFrequencyData(dataArrayRef.current!);
      pathRef.current!.attr('d', areaRef.current!(Array.from(dataArrayRef.current!)));
      animationId = requestAnimationFrame(update);
    };
    animationId = requestAnimationFrame(update);

    return () => cancelAnimationFrame(animationId);
  }, [analyser, isPlaying]);

  return (
    <div className="w-full h-16 bg-indigo-50/20 dark:bg-white/5 rounded-[1.5rem] overflow-hidden border border-indigo-100 dark:border-white/10 relative">
      <div className="absolute inset-0 flex items-center justify-center">
         <div className="w-full h-[1px] bg-indigo-500/10"></div>
      </div>
      <svg ref={svgRef} className="w-full h-full relative z-10"></svg>
    </div>
  );
};

export default AudioVisualizer;
