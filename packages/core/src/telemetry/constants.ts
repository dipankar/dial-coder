/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export const SERVICE_NAME = 'dial-coder';

export const EVENT_USER_PROMPT = 'dial-coder.user_prompt';
export const EVENT_TOOL_CALL = 'dial-coder.tool_call';
export const EVENT_API_REQUEST = 'dial-coder.api_request';
export const EVENT_API_ERROR = 'dial-coder.api_error';
export const EVENT_API_CANCEL = 'dial-coder.api_cancel';
export const EVENT_API_RESPONSE = 'dial-coder.api_response';
export const EVENT_CLI_CONFIG = 'dial-coder.config';
export const EVENT_EXTENSION_DISABLE = 'dial-coder.extension_disable';
export const EVENT_EXTENSION_ENABLE = 'dial-coder.extension_enable';
export const EVENT_EXTENSION_INSTALL = 'dial-coder.extension_install';
export const EVENT_EXTENSION_UNINSTALL = 'dial-coder.extension_uninstall';
export const EVENT_FLASH_FALLBACK = 'dial-coder.flash_fallback';
export const EVENT_RIPGREP_FALLBACK = 'dial-coder.ripgrep_fallback';
export const EVENT_NEXT_SPEAKER_CHECK = 'dial-coder.next_speaker_check';
export const EVENT_SLASH_COMMAND = 'dial-coder.slash_command';
export const EVENT_IDE_CONNECTION = 'dial-coder.ide_connection';
export const EVENT_CHAT_COMPRESSION = 'dial-coder.chat_compression';
export const EVENT_INVALID_CHUNK = 'dial-coder.chat.invalid_chunk';
export const EVENT_CONTENT_RETRY = 'dial-coder.chat.content_retry';
export const EVENT_CONTENT_RETRY_FAILURE =
  'dial-coder.chat.content_retry_failure';
export const EVENT_CONVERSATION_FINISHED = 'dial-coder.conversation_finished';
export const EVENT_MALFORMED_JSON_RESPONSE =
  'dial-coder.malformed_json_response';
export const EVENT_FILE_OPERATION = 'dial-coder.file_operation';
export const EVENT_MODEL_SLASH_COMMAND = 'dial-coder.slash_command.model';
export const EVENT_SUBAGENT_EXECUTION = 'dial-coder.subagent_execution';
export const EVENT_AUTH = 'dial-coder.auth';

// Performance Events
export const EVENT_STARTUP_PERFORMANCE = 'dial-coder.startup.performance';
export const EVENT_MEMORY_USAGE = 'dial-coder.memory.usage';
export const EVENT_PERFORMANCE_BASELINE = 'dial-coder.performance.baseline';
export const EVENT_PERFORMANCE_REGRESSION = 'dial-coder.performance.regression';
