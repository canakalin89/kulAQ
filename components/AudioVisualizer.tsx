
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyser, isPlaying }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !analyser) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); 

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const x = d3.scaleLinear().domain([0, bufferLength]).range([0, width]);
    const y = d3.scaleLinear().domain([0, 255]).range([height, 0]);

    const path = svg.append("path")
      .attr("fill", "url(#wave-gradient)")
      .attr("stroke", "rgba(30, 27, 75, 0.2)")
      .attr("stroke-width", 1);

    const area = d3.area<number>()
      .x((d, i) => x(i))
      .y0(height / 2)
      .y1(d => (height / 2) + (d / 4))
      .curve(d3.curveBasis);

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "wave-gradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "0%");
    
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#f97316");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#1e1b4b");

    let animationId: number;

    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      path.attr("d", area(Array.from(dataArray)));
      animationId = requestAnimationFrame(update);
    };

    if (isPlaying) {
      update();
    } else {
      path.attr("d", area(new Array(bufferLength).fill(0)));
    }

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
