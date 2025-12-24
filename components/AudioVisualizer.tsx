
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
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const x = d3.scaleLinear().domain([0, bufferLength]).range([0, width]);
    const y = d3.scaleLinear().domain([0, 255]).range([height, 0]);

    const barWidth = (width / bufferLength) * 2.5;
    
    const bars = svg.selectAll('rect')
      .data(Array.from(dataArray))
      .enter()
      .append('rect')
      .attr('fill', '#6366f1')
      .attr('rx', 2);

    let animationId: number;

    const update = () => {
      analyser.getByteFrequencyData(dataArray);

      svg.selectAll('rect')
        .data(Array.from(dataArray))
        .attr('x', (d, i) => x(i))
        .attr('y', d => y(d))
        .attr('width', barWidth)
        .attr('height', d => height - y(d))
        .attr('fill', (d, i) => `rgb(${Math.max(99, d)}, 102, 241)`);

      animationId = requestAnimationFrame(update);
    };

    if (isPlaying) {
      update();
    }

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyser, isPlaying]);

  return (
    <div className="w-full h-24 bg-slate-900/50 rounded-lg overflow-hidden border border-slate-700">
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};

export default AudioVisualizer;
