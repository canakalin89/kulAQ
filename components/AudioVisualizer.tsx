
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
    svg.selectAll("*").remove(); // Clear previous

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const x = d3.scaleLinear().domain([0, bufferLength]).range([0, width]);
    const y = d3.scaleLinear().domain([0, 255]).range([height, 0]);

    const path = svg.append("path")
      .attr("fill", "url(#wave-gradient)")
      .attr("stroke", "rgba(99, 102, 241, 0.8)")
      .attr("stroke-width", 2);

    const area = d3.area<number>()
      .x((d, i) => x(i))
      .y0(height / 2)
      .y1(d => (height / 2) + (d / 2))
      .curve(d3.curveBasis);

    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "wave-gradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");
    
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "rgba(99, 102, 241, 0.4)");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "rgba(99, 102, 241, 0)");

    let animationId: number;

    const update = () => {
      analyser.getByteFrequencyData(dataArray);
      
      const mirrorData = Array.from(dataArray);
      path.attr("d", area(mirrorData));

      animationId = requestAnimationFrame(update);
    };

    if (isPlaying) {
      update();
    } else {
      // Draw a flat line when not playing
      path.attr("d", area(new Array(bufferLength).fill(0)));
    }

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, isPlaying]);

  return (
    <div className="w-full h-24 bg-black/20 rounded-2xl overflow-hidden border border-white/5 shadow-inner">
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};

export default AudioVisualizer;
