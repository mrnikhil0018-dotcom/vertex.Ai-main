import React from 'react';
import {Text} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import {GRADIENTS} from '../utils/theme';

const GradientText = ({children, style, colors = GRADIENTS.brand}) => (
  <MaskedView maskElement={<Text style={style}>{children}</Text>}>
    <LinearGradient colors={colors} start={{x: 0, y: 0.5}} end={{x: 1, y: 0.5}}>
      <Text style={[style, {opacity: 0}]}>{children}</Text>
    </LinearGradient>
  </MaskedView>
);

export default GradientText;
