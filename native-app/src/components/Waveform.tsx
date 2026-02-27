import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Rect } from "react-native-svg";

type WaveformProps = {
  width?: number;
  height?: number;
  bars?: number;
};

export const Waveform = ({ width = 320, height = 70, bars = 34 }: WaveformProps) => {
  const values = useMemo(() => {
    return Array.from({ length: bars }, (_, index) => {
      const base = Math.sin(index * 0.45) * 0.5 + 0.5;
      return Math.max(0.12, base);
    });
  }, [bars]);

  const barWidth = width / bars;

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        {values.map((value, index) => {
          const barHeight = value * height;
          const x = index * barWidth + barWidth * 0.2;
          const y = (height - barHeight) / 2;

          return (
            <Rect
              key={index}
              x={x}
              y={y}
              width={barWidth * 0.6}
              height={barHeight}
              rx={barWidth * 0.3}
              fill="#38bdf8"
              opacity={0.75}
            />
          );
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 16
  }
});
