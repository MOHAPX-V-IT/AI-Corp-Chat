import React, { useCallback, useRef } from 'react';
import { useRecoilValue } from 'recoil';
import { Save, Loader2 } from 'lucide-react';
import { useToastContext } from '@librechat/client';
import { useSaveToIprMutation } from '~/data-provider';
import store from '~/store';

interface SaveToIprButtonProps {
  conversationId?: string;
  agentId?: string;
  disabled?: boolean;
  hasMessages?: boolean;
  isNewcomer?: boolean;
}

const SaveToIprButton: React.FC<SaveToIprButtonProps> = ({
  conversationId,
  agentId,
  disabled,
  hasMessages = false,
  isNewcomer = false,
}) => {
  const { showToast } = useToastContext();
  const saveToIprMutation = useSaveToIprMutation();
  const newcomerProfileId = useRecoilValue(store.selectedNewcomerProfileId);
  const saving = useRef(false);

  const handleSave = useCallback(async () => {
    if (disabled || saving.current) return;
    if (!hasMessages) {
      showToast({
        message: 'Отправьте сообщение в ИИ, а после нажмите Сохранить',
        status: 'warning',
      });
      return;
    }

    if (!conversationId || conversationId === 'new') {
      showToast({ message: 'Не удалось определить диалог', status: 'error' });
      return;
    }

    saving.current = true;
    try {
      const result = await saveToIprMutation.mutateAsync({
        conversationId,
        agentId,
        ...(isNewcomer && newcomerProfileId && { newcomerProfileId }),
      });

      showToast({
        message: `Запись по сотруднику ${result.employeeName} успешно сохранена в Базу ИПР`,
        status: 'success',
      });
    } catch (error: any) {
      console.error('[SaveToIprButton] Error:', error);
      showToast({
        message: error?.response?.data?.error || error?.message || 'Не удалось сохранить в ИПР. Попробуйте еще раз.',
        status: 'error',
      });
    } finally {
      saving.current = false;
    }
  }, [conversationId, agentId, hasMessages, disabled, isNewcomer, newcomerProfileId, saveToIprMutation, showToast]);

  const isDisabled = disabled || saveToIprMutation.isLoading || !hasMessages;
  const tooltipText = !hasMessages
    ? 'Кнопка станет доступна после ответа ИИ'
    : 'Добавить этот разбор в историю развития сотрудника';

  return (
    <button
      type="button"
      data-testid="save-to-ipr-button"
      aria-busy={saveToIprMutation.isLoading}
      onClick={handleSave}
      disabled={isDisabled}
      className="flex min-h-10 items-center gap-2 rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      title={tooltipText}
    >
      {saveToIprMutation.isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
      <span>
        {saveToIprMutation.isLoading ? 'Сохраняем в ИПР…' : 'Добавить в ИПР'}
      </span>
    </button>
  );
};

export default SaveToIprButton;
