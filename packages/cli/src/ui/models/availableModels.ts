/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType, DEFAULT_QWEN_MODEL } from '@dial-coder/core';
import { t } from '../../i18n/index.js';

export type AvailableModel = {
  id: string;
  label: string;
  description?: string;
  isVision?: boolean;
};

export const MAINLINE_VLM = 'vision-model';
export const MAINLINE_CODER = DEFAULT_QWEN_MODEL;

export const AVAILABLE_MODELS_QWEN: AvailableModel[] = [
  {
    id: MAINLINE_CODER,
    label: MAINLINE_CODER,
    get description() {
      return t(
        'The latest Qwen Coder model from Alibaba Cloud ModelStudio (version: qwen3-coder-plus-2025-09-23)',
      );
    },
  },
  {
    id: MAINLINE_VLM,
    label: MAINLINE_VLM,
    get description() {
      return t(
        'The latest Qwen Vision model from Alibaba Cloud ModelStudio (version: qwen3-vl-plus-2025-09-23)',
      );
    },
    isVision: true,
  },
];

export const AVAILABLE_MODELS_GEMINI: AvailableModel[] = [
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    get description() {
      return t("Google's most capable model for complex reasoning tasks");
    },
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    get description() {
      return t('Fast and efficient model for everyday tasks');
    },
  },
  {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    get description() {
      return t('Previous generation flash model');
    },
  },
];

export const AVAILABLE_MODELS_MISTRAL: AvailableModel[] = [
  {
    id: 'mistral-large-latest',
    label: 'Mistral Large',
    get description() {
      return t("Mistral's flagship model for complex tasks");
    },
  },
  {
    id: 'mistral-medium-latest',
    label: 'Mistral Medium',
    get description() {
      return t('Balanced model for most use cases');
    },
  },
  {
    id: 'mistral-small-latest',
    label: 'Mistral Small',
    get description() {
      return t('Fast and cost-effective model');
    },
  },
  {
    id: 'codestral-latest',
    label: 'Codestral',
    get description() {
      return t('Specialized model for code generation');
    },
  },
];

/**
 * Get available Qwen models filtered by vision model preview setting
 */
export function getFilteredQwenModels(
  visionModelPreviewEnabled: boolean,
): AvailableModel[] {
  if (visionModelPreviewEnabled) {
    return AVAILABLE_MODELS_QWEN;
  }
  return AVAILABLE_MODELS_QWEN.filter((model) => !model.isVision);
}

/**
 * Currently we use the single model of `OPENAI_MODEL` in the env.
 * In the future, after settings.json is updated, we will allow users to configure this themselves.
 */
export function getOpenAIAvailableModelFromEnv(): AvailableModel | null {
  const id = process.env['OPENAI_MODEL']?.trim();
  return id ? { id, label: id } : null;
}

export function getAvailableModelsForAuthType(
  authType: AuthType,
): AvailableModel[] {
  switch (authType) {
    case AuthType.QWEN_OAUTH:
      return AVAILABLE_MODELS_QWEN;
    case AuthType.USE_OPENAI: {
      const openAIModel = getOpenAIAvailableModelFromEnv();
      return openAIModel ? [openAIModel] : [];
    }
    case AuthType.LOGIN_WITH_GOOGLE:
    case AuthType.USE_GEMINI:
      return AVAILABLE_MODELS_GEMINI;
    case AuthType.USE_MISTRAL:
      return AVAILABLE_MODELS_MISTRAL;
    default:
      return [];
  }
}

/**
/**
 * Hard code the default vision model as a string literal,
 * until our coding model supports multimodal.
 */
export function getDefaultVisionModel(): string {
  return MAINLINE_VLM;
}

export function isVisionModel(modelId: string): boolean {
  return AVAILABLE_MODELS_QWEN.some(
    (model) => model.id === modelId && model.isVision,
  );
}
