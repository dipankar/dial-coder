/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type ColorsTheme, Theme } from './theme.js';
import { lightSemanticColors } from './semantic-tokens.js';

const dialLightColors: ColorsTheme = {
  type: 'light',
  Background: '#f8f9fa',
  Foreground: '#5c6166',
  LightBlue: '#55b4d4',
  AccentBlue: '#399ee6',
  AccentPurple: '#a37acc',
  AccentCyan: '#4cbf99',
  AccentGreen: '#86b300',
  AccentYellow: '#f2ae49',
  AccentRed: '#f07171',
  DiffAdded: '#86b300',
  DiffRemoved: '#f07171',
  Comment: '#ABADB1',
  Gray: '#CCCFD3',
  GradientColors: ['#399ee6', '#86b300'],
};

export const DialLight: Theme = new Theme(
  'Qwen Light',
  'light',
  {
    hljs: {
      display: 'block',
      overflowX: 'auto',
      padding: '0.5em',
      background: dialLightColors.Background,
      color: dialLightColors.Foreground,
    },
    'hljs-comment': {
      color: dialLightColors.Comment,
      fontStyle: 'italic',
    },
    'hljs-quote': {
      color: dialLightColors.AccentCyan,
      fontStyle: 'italic',
    },
    'hljs-string': {
      color: dialLightColors.AccentGreen,
    },
    'hljs-constant': {
      color: dialLightColors.AccentCyan,
    },
    'hljs-number': {
      color: dialLightColors.AccentPurple,
    },
    'hljs-keyword': {
      color: dialLightColors.AccentYellow,
    },
    'hljs-selector-tag': {
      color: dialLightColors.AccentYellow,
    },
    'hljs-attribute': {
      color: dialLightColors.AccentYellow,
    },
    'hljs-variable': {
      color: dialLightColors.Foreground,
    },
    'hljs-variable.language': {
      color: dialLightColors.LightBlue,
      fontStyle: 'italic',
    },
    'hljs-title': {
      color: dialLightColors.AccentBlue,
    },
    'hljs-section': {
      color: dialLightColors.AccentGreen,
      fontWeight: 'bold',
    },
    'hljs-type': {
      color: dialLightColors.LightBlue,
    },
    'hljs-class .hljs-title': {
      color: dialLightColors.AccentBlue,
    },
    'hljs-tag': {
      color: dialLightColors.LightBlue,
    },
    'hljs-name': {
      color: dialLightColors.AccentBlue,
    },
    'hljs-builtin-name': {
      color: dialLightColors.AccentYellow,
    },
    'hljs-meta': {
      color: dialLightColors.AccentYellow,
    },
    'hljs-symbol': {
      color: dialLightColors.AccentRed,
    },
    'hljs-bullet': {
      color: dialLightColors.AccentYellow,
    },
    'hljs-regexp': {
      color: dialLightColors.AccentCyan,
    },
    'hljs-link': {
      color: dialLightColors.LightBlue,
    },
    'hljs-deletion': {
      color: dialLightColors.AccentRed,
    },
    'hljs-addition': {
      color: dialLightColors.AccentGreen,
    },
    'hljs-emphasis': {
      fontStyle: 'italic',
    },
    'hljs-strong': {
      fontWeight: 'bold',
    },
    'hljs-literal': {
      color: dialLightColors.AccentCyan,
    },
    'hljs-built_in': {
      color: dialLightColors.AccentRed,
    },
    'hljs-doctag': {
      color: dialLightColors.AccentRed,
    },
    'hljs-template-variable': {
      color: dialLightColors.AccentCyan,
    },
    'hljs-selector-id': {
      color: dialLightColors.AccentRed,
    },
  },
  dialLightColors,
  lightSemanticColors,
);
