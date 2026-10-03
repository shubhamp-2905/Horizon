declare module 'react-native' {
  import * as React from 'react';

  export type StyleProp<T> = T | Array<T | undefined | null | false> | undefined | null | false;

  export interface ViewStyle {
    backgroundColor?: string;
    borderWidth?: number;
    borderColor?: string;
    borderRadius?: number;
    borderTopLeftRadius?: number;
    borderTopRightRadius?: number;
    borderBottomLeftRadius?: number;
    borderBottomRightRadius?: number;
    borderBottomColor?: string;
    borderTopColor?: string;
    borderLeftColor?: string;
    borderRightColor?: string;
    borderBottomWidth?: number;
    borderTopWidth?: number;
    borderLeftWidth?: number;
    borderRightWidth?: number;
    padding?: number;
    paddingHorizontal?: number;
    paddingVertical?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
    margin?: number;
    marginHorizontal?: number;
    marginVertical?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    flex?: number;
    flexGrow?: number;
    flexShrink?: number;
    flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
    alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
    alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
    width?: number | string;
    height?: number | string;
    minWidth?: number | string;
    minHeight?: number | string;
    maxWidth?: number | string;
    maxHeight?: number | string;
    gap?: number;
    opacity?: number;
    overflow?: 'visible' | 'hidden' | 'scroll';
    position?: 'absolute' | 'relative';
    top?: number | string;
    bottom?: number | string;
    left?: number | string;
    right?: number | string;
    zIndex?: number;
    elevation?: number;
    shadowColor?: string;
    shadowOffset?: { width: number; height: number };
    shadowOpacity?: number;
    shadowRadius?: number;
    display?: 'none' | 'flex';
  }

  export interface TextStyle extends ViewStyle {
    color?: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
    fontStyle?: 'normal' | 'italic';
    fontFamily?: string;
    textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify';
    textDecorationLine?: 'none' | 'underline' | 'line-through' | 'underline line-through';
    lineHeight?: number;
    letterSpacing?: number;
    textTransform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase';
  }

  export interface ImageStyle extends ViewStyle {
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  }

  export type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

  export namespace StyleSheet {
    export function create<T extends NamedStyles<T> | NamedStyles<any>>(styles: T | NamedStyles<T>): T;
    export const hairlineWidth: number;
    export function flatten<T>(style?: StyleProp<T>): T;
    export const absoluteFillObject: ViewStyle;
    export const absoluteFill: ViewStyle;
  }

  export interface ViewProps {
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
    testID?: string;
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
    accessibilityLabel?: string;
    accessibilityRole?: string;
  }

  export interface TextProps {
    style?: StyleProp<TextStyle>;
    children?: React.ReactNode;
    numberOfLines?: number;
    ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
    onPress?: () => void;
    testID?: string;
    accessibilityLabel?: string;
  }

  export interface TouchableOpacityProps extends ViewProps {
    onPress?: () => void;
    activeOpacity?: number;
    disabled?: boolean;
  }

  export interface PressableProps extends ViewProps {
    onPress?: () => void;
    disabled?: boolean;
    style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  }

  export interface TextInputProps extends ViewProps {
    value?: string;
    onChangeText?: (text: string) => void;
    onBlur?: () => void;
    onFocus?: () => void;
    placeholder?: string;
    placeholderTextColor?: string;
    secureTextEntry?: boolean;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'number-pad';
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    autoCorrect?: boolean;
    multiline?: boolean;
    numberOfLines?: number;
    textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center';
    editable?: boolean;
    style?: StyleProp<TextStyle>;
  }

  export interface ScrollViewProps extends ViewProps {
    contentContainerStyle?: StyleProp<ViewStyle>;
    showsVerticalScrollIndicator?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    horizontal?: boolean;
    refreshControl?: React.ReactElement;
  }

  export interface ActivityIndicatorProps extends ViewProps {
    size?: 'small' | 'large' | number;
    color?: string;
    animating?: boolean;
  }

  export interface ModalProps extends ViewProps {
    visible?: boolean;
    animationType?: 'none' | 'slide' | 'fade';
    transparent?: boolean;
    onRequestClose?: () => void;
  }

  export interface AlertButton {
    text?: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }

  export interface AlertOptions {
    cancelable?: boolean;
  }

  export namespace Alert {
    export function alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void;
  }

  export interface DimensionsObject {
    width: number;
    height: number;
    scale: number;
    fontScale: number;
  }

  export namespace Dimensions {
    export function get(dim: 'window' | 'screen'): DimensionsObject;
    export function addEventListener(type: 'change', handler: (dims: { window: DimensionsObject; screen: DimensionsObject }) => void): { remove: () => void };
  }

  export const Platform: {
    OS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
    select: <T>(specifics: { [platform: string]: T }) => T;
  };

  export const View: React.FC<ViewProps>;
  export const Text: React.FC<TextProps>;
  export const TouchableOpacity: React.FC<TouchableOpacityProps>;
  export const Pressable: React.FC<PressableProps>;
  export const SafeAreaView: React.FC<ViewProps>;
  export interface RefreshControlProps extends ViewProps {
    refreshing: boolean;
    onRefresh?: () => void;
    tintColor?: string;
    colors?: string[];
  }

  export const RefreshControl: React.FC<RefreshControlProps>;
  export const ScrollView: React.FC<ScrollViewProps>;
  export const TextInput: React.FC<TextInputProps>;
  export const ActivityIndicator: React.FC<ActivityIndicatorProps>;
  export const Modal: React.FC<ModalProps>;
  export interface ImageProps extends ViewProps {
    source: { uri?: string } | any;
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
    style?: StyleProp<ImageStyle>;
  }
  export const Image: React.FC<ImageProps>;
  export const StatusBar: React.FC<{ barStyle?: 'default' | 'light-content' | 'dark-content'; backgroundColor?: string }>;
}
