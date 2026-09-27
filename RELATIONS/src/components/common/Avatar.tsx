import React from 'react';
import {View, Text, StyleSheet, Image} from 'react-native';
import {colors, borderRadius} from '../../theme';
import {RelationType} from '../../types';

interface AvatarProps {
  name: string;
  avatar?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  relationType?: RelationType;
}

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getColor = (name: string, relationType?: RelationType) => {
  if (relationType) {
    return colors.relation[relationType];
  }
  const colorPalette = [
    '#6366F1',
    '#8B5CF6',
    '#EC4899',
    '#3B82F6',
    '#10B981',
    '#F59E0B',
  ];
  const index = name.charCodeAt(0) % colorPalette.length;
  return colorPalette[index];
};

export const Avatar: React.FC<AvatarProps> = ({
  name,
  avatar,
  size = 'md',
  relationType,
}) => {
  const getSize = () => {
    switch (size) {
      case 'sm':
        return 36;
      case 'lg':
        return 64;
      case 'xl':
        return 80;
      default:
        return 48;
    }
  };

  const dimension = getSize();
  const backgroundColor = getColor(name, relationType);

  if (avatar) {
    return (
      <Image
        source={{uri: avatar}}
        style={[
          styles.avatar,
          {
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.initials,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor,
        },
      ]}>
      <Text
        style={[
          styles.initialsText,
          {fontSize: dimension * 0.4},
        ]}>
        {getInitials(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.border,
  },
  initials: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: colors.surface,
    fontWeight: '600',
  },
});
