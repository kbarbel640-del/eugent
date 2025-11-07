import React, { useState } from 'react';
import { useInput, Text, Box } from 'ink';

interface TextAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onTab?: () => void;
  placeholder?: string;
  focus?: boolean;
}

export const TextArea: React.FC<TextAreaProps> = ({
  value,
  onChange,
  onSubmit,
  onTab,
  placeholder = '',
  focus = true,
}) => {
  const [cursorPos, setCursorPos] = useState(value.length);
  const lastEscapeTime = React.useRef<number>(0);
  const prevValueRef = React.useRef(value);

  React.useEffect(() => {
    const prevValue = prevValueRef.current;
    if (value !== prevValue) {
      if (value === '') {
        setCursorPos(0);
      } else if (cursorPos > value.length) {
        setCursorPos(value.length);
      }
      prevValueRef.current = value;
    }
  }, [value, cursorPos]);

  useInput(
    (input, key) => {
      if (key.leftArrow) {
        setCursorPos(Math.max(cursorPos - 1, 0));
        return;
      }

      if (key.rightArrow) {
        setCursorPos(Math.min(cursorPos + 1, value.length));
        return;
      }

      if (key.tab && onTab) {
        onTab();
        return;
      }

      if (key.escape) {
        const now = Date.now();
        if (now - lastEscapeTime.current < 500) {
          onChange('');
          setCursorPos(0);
          lastEscapeTime.current = 0;
        } else {
          lastEscapeTime.current = now;
        }
        return;
      }

      if (key.return && !key.shift && !key.ctrl && !key.meta) {
        onSubmit(value);
        return;
      }

      if (input && /\[27;5;13~|\[27;13;5~/.test(input)) {
        const newValue = value.slice(0, cursorPos) + '\n' + value.slice(cursorPos);
        onChange(newValue);
        setCursorPos(cursorPos + 1);
        return;
      }

      if (input && /[\r\x1b\[]/.test(input)) {
        return;
      }

      if (key.backspace || key.delete) {
        if (cursorPos > 0) {
          const newValue = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
          onChange(newValue);
          setCursorPos(cursorPos - 1);
        }
        return;
      }

      if (input) {
        const newValue = value.slice(0, cursorPos) + input + value.slice(cursorPos);
        onChange(newValue);
        setCursorPos(cursorPos + input.length);
      }
    },
    { isActive: focus }
  );

  const displayValue = value || placeholder;
  const showPlaceholder = !value && !!placeholder;
  const lines = displayValue.split('\n');

  let cursorLine = 0;
  let cursorCol = 0;

  if (!showPlaceholder) {
    let charsProcessed = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length;
      if (charsProcessed + lineLength >= cursorPos) {
        cursorLine = i;
        cursorCol = cursorPos - charsProcessed;
        break;
      }
      charsProcessed += lineLength + 1;
    }
  }

  return (
    <Box flexDirection="column">
      {lines.map((line, lineIndex) => (
        <Box key={lineIndex}>
          {!showPlaceholder && lineIndex === cursorLine ? (
            <>
              <Text>{line.slice(0, cursorCol)}</Text>
              <Text inverse>{line[cursorCol] || ' '}</Text>
              <Text>{line.slice(cursorCol + 1)}</Text>
            </>
          ) : (
            <Text dimColor={showPlaceholder}>{line || ' '}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
};
