import React from 'react';
import { Box, Text } from 'ink';

interface FileGridProps {
  files: string[];
  columns?: number;
}

/**
 * FileGrid - Multi-column file listing component
 *
 * Displays files in a responsive grid layout using Yoga's flexWrap.
 * Automatically adapts to terminal width.
 */
export const FileGrid: React.FC<FileGridProps> = ({ files, columns = 3 }) => {
  const columnWidth = `${Math.floor(100 / columns)}%`;

  return (
    <Box flexDirection="row" flexWrap="wrap" width="100%">
      {files.map((file) => (
        <Box key={file} width={columnWidth} minWidth={20} paddingRight={1}>
          <Text>{file}</Text>
        </Box>
      ))}
    </Box>
  );
};
