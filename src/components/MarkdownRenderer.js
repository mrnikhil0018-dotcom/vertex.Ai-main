import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {COLORS, FONT} from '../utils/theme';

const inlineParts = text => {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      parts.push({type: 'text', value: text.slice(lastIndex, match.index)});
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push({type: 'bold', value: token.slice(2, -2)});
    } else if (token.startsWith('`')) {
      parts.push({type: 'code', value: token.slice(1, -1)});
    } else {
      parts.push({type: 'italic', value: token.slice(1, -1)});
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    parts.push({type: 'text', value: text.slice(lastIndex)});
  }
  return parts;
};

const InlineText = ({children, style}) => (
  <Text style={[styles.paragraph, style]}>
    {inlineParts(children).map((part, index) => {
      if (part.type === 'bold') {
        return (
          <Text key={index} style={styles.bold}>
            {part.value}
          </Text>
        );
      }
      if (part.type === 'italic') {
        return (
          <Text key={index} style={styles.italic}>
            {part.value}
          </Text>
        );
      }
      if (part.type === 'code') {
        return (
          <Text key={index} style={styles.inlineCode}>
            {part.value}
          </Text>
        );
      }
      return <Text key={index}>{part.value}</Text>;
    })}
  </Text>
);

const MarkdownRenderer = ({content}) => {
  const lines = String(content || '').split('\n');
  const blocks = [];
  let code = null;
  let list = [];

  const flushList = () => {
    if (list.length) {
      blocks.push({type: 'list', items: list});
      list = [];
    }
  };

  lines.forEach(line => {
    const fence = line.match(/^```/);
    if (fence) {
      if (code) {
        blocks.push({type: 'code', value: code.lines.join('\n')});
        code = null;
      } else {
        flushList();
        code = {lines: []};
      }
      return;
    }
    if (code) {
      code.lines.push(line);
      return;
    }
    const bullet = line.match(/^\s*[-*+]\s+(.+)/);
    const numbered = line.match(/^\s*\d+\.\s+(.+)/);
    if (bullet || numbered) {
      list.push((bullet || numbered)[1]);
      return;
    }
    flushList();
    if (!line.trim()) {
      blocks.push({type: 'space'});
    } else if (line.startsWith('### ')) {
      blocks.push({type: 'h3', value: line.slice(4)});
    } else if (line.startsWith('## ')) {
      blocks.push({type: 'h2', value: line.slice(3)});
    } else if (line.startsWith('# ')) {
      blocks.push({type: 'h1', value: line.slice(2)});
    } else if (line.startsWith('> ')) {
      blocks.push({type: 'quote', value: line.slice(2)});
    } else {
      blocks.push({type: 'p', value: line});
    }
  });
  flushList();
  if (code) {
    blocks.push({type: 'code', value: code.lines.join('\n')});
  }

  return (
    <View>
      {blocks.map((block, index) => {
        if (block.type === 'space') {
          return <View key={index} style={styles.space} />;
        }
        if (block.type === 'code') {
          return (
            <View key={index} style={styles.codeBlock}>
              <Text selectable style={styles.codeText}>
                {block.value}
              </Text>
            </View>
          );
        }
        if (block.type === 'list') {
          return (
            <View key={index} style={styles.list}>
              {block.items.map((item, itemIndex) => (
                <View key={`${index}-${itemIndex}`} style={styles.listRow}>
                  <Text style={styles.bullet}>-</Text>
                  <InlineText style={styles.listText}>{item}</InlineText>
                </View>
              ))}
            </View>
          );
        }
        if (block.type === 'quote') {
          return (
            <View key={index} style={styles.quote}>
              <InlineText style={styles.quoteText}>{block.value}</InlineText>
            </View>
          );
        }
        const headingStyle =
          block.type === 'h1'
            ? styles.h1
            : block.type === 'h2'
            ? styles.h2
            : styles.h3;
        if (['h1', 'h2', 'h3'].includes(block.type)) {
          return (
            <Text key={index} style={headingStyle}>
              {block.value}
            </Text>
          );
        }
        return <InlineText key={index}>{block.value}</InlineText>;
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  paragraph: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 23,
    fontFamily: FONT.regular,
  },
  bold: {
    fontFamily: FONT.extraBold,
    fontWeight: '800',
  },
  italic: {
    fontStyle: 'italic',
  },
  inlineCode: {
    color: '#a5b4fc',
    backgroundColor: 'rgba(99,102,241,0.15)',
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  codeBlock: {
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
  },
  codeText: {
    color: '#c5e8ff',
    fontSize: 12,
    lineHeight: 19,
    fontFamily: 'monospace',
  },
  h1: {
    color: COLORS.text,
    fontSize: 18,
    lineHeight: 24,
    fontFamily: FONT.extraBold,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  h2: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: FONT.extraBold,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  h3: {
    color: COLORS.soft,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FONT.bold,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  list: {
    marginVertical: 4,
    gap: 4,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bullet: {
    color: COLORS.soft,
    lineHeight: 22,
  },
  listText: {
    flex: 1,
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: COLORS.purple,
    paddingLeft: 10,
    marginVertical: 6,
  },
  quoteText: {
    color: COLORS.soft,
    fontStyle: 'italic',
  },
  space: {
    height: 6,
  },
});

export default MarkdownRenderer;
