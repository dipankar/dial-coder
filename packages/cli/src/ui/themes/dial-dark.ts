/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { darkSemanticColors } from './semantic-tokens.js';

const dialDarkColors: ColorsTheme = {
  type: 'dark',
  Background: '#0b0e14',
  Foreground: '#bfbdb6',
  LightBlue: '#59C2FF',
  AccentBlue: '#39BAE6',
  AccentPurple: '#D2A6FF',
  AccentCyan: '#95E6CB',
  AccentGreen: '#AAD94C',
  AccentYellow: '#FFD700',
  AccentRed: '#F26D78',
  DiffAdded: '#AAD94C',
  DiffRemoved: '#F26D78',
  Comment: '#646A71',
  Gray: '#3D4149',
  GradientColors: ['#FFD700', '#da7959'],
};

export const DialDark: Theme = new Theme(
  'Qwen Dark',
  'dark',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: dialDarkColors.Background,
      color: dialDarkColors.Foreground,
    },
    'hljs-keyword': {
      color: dialDarkColors.AccentYellow,
    },
    'hljs-literal': {
      color: dialDarkColors.AccentPurple,
    },
    'hljs-symbol': {
      color: dialDarkColors.AccentCyan,
    },
    'hljs-name': {
      color: dialDarkColors.LightBlue,
    },
    'hljs-link': {
      color: dialDarkColors.AccentBlue,
    },
    'hljs-function .hljs-keyword': {
      color: dialDarkColors.AccentYellow,
    },
    'hljs-subst': {
      color: dialDarkColors.Foreground,
    },
    'hljs-string': {
      color: dialDarkColors.AccentGreen,
    },
    'hljs-title': {
      color: dialDarkColors.AccentYellow,
    },
    'hljs-type': {
      color: dialDarkColors.AccentBlue,
    },
    'hljs-attribute': {
      color: dialDarkColors.AccentYellow,
    },
    'hljs-bullet': {
      color: dialDarkColors.AccentYellow,
    },
    'hljs-addition': {
      color: dialDarkColors.AccentGreen,
    },
    'hljs-variable': {
      color: dialDarkColors.Foreground,
    },
    'hljs-template-tag': {
      color: dialDarkColors.AccentYellow,
    },
    'hljs-template-variable': {
      color: dialDarkColors.AccentYellow,
    },
    'hljs-comment': {
      color: dialDarkColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: dialDarkColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-deletion': {
      color: dialDarkColors.AccentRed,
    },
    'hljs-meta': {
      color: dialDarkColors.AccentYellow,
    },
    'hljs-doctag': {
      fontWeight: 'bold',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
  },
  dialDarkColors,
  darkSemanticColors,
);
