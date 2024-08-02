import {
  CheckOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  MenuOutlined,
  SaveOutlined,
  SyncOutlined
} from '@ant-design/icons'
import { getModelLogo } from '@renderer/config/provider'
import { useAssistant } from '@renderer/hooks/useAssistant'
import useAvatar from '@renderer/hooks/useAvatar'
import { useSettings } from '@renderer/hooks/useSettings'
import { useRuntime } from '@renderer/hooks/useStore'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/event'
import { Message } from '@renderer/types'
import { firstLetter, removeLeadingEmoji } from '@renderer/utils'
import { Avatar, Dropdown, Tooltip } from 'antd'
import dayjs from 'dayjs'
import { upperFirst } from 'lodash'
import { FC, memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import Markdown from './markdown/Markdown'

interface Props {
  message: Message
  index?: number
  total?: number
  showMenu?: boolean
  onDeleteMessage?: (message: Message) => void
}

const MessageItem: FC<Props> = ({ message, index, showMenu, onDeleteMessage }) => {
  const avatar = useAvatar()
  const { t } = useTranslation()
  const { assistant } = useAssistant(message.assistantId)
  const { userName, showMessageDivider, messageFont } = useSettings()
  const { generating } = useRuntime()
  const [copied, setCopied] = useState(false)

  const isLastMessage = index === 0
  const isUserMessage = message.role === 'user'
  const isAssistantMessage = message.role === 'assistant'
  const canRegenerate = isLastMessage && isAssistantMessage

  const onCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content)
    window.message.success({ content: t('message.copied'), key: 'copy-message' })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message.content, t])

  const onDelete = useCallback(async () => {
    const confirmed = await window.modal.confirm({
      icon: null,
      title: t('message.message.delete.title'),
      content: t('message.message.delete.content'),
      okText: t('common.delete'),
      okType: 'danger'
    })
    confirmed && onDeleteMessage?.(message)
  }, [message, onDeleteMessage, t])

  const onEdit = useCallback(() => EventEmitter.emit(EVENT_NAMES.EDIT_MESSAGE, message), [message])

  const onRegenerate = useCallback(() => {
    onDeleteMessage?.(message)
    setTimeout(() => EventEmitter.emit(EVENT_NAMES.REGENERATE_MESSAGE), 100)
  }, [message, onDeleteMessage])

  const getUserName = useCallback(() => {
    if (message.id === 'assistant') return assistant?.name
    if (message.role === 'assistant') return upperFirst(message.modelId)
    return userName || t('common.you')
  }, [assistant?.name, message.id, message.modelId, message.role, t, userName])

  const serifFonts = "Georgia, Cambria, 'Times New Roman', Times, serif"
  const fontFamily = messageFont === 'serif' ? serifFonts : 'Poppins, -apple-system, sans-serif'
  const messageBorder = showMessageDivider ? undefined : 'none'
  const avatarSource = useMemo(() => (message.modelId ? getModelLogo(message.modelId) : undefined), [message.modelId])
  const avatarName = useMemo(() => firstLetter(assistant?.name).toUpperCase(), [assistant?.name])
  const username = useMemo(() => removeLeadingEmoji(getUserName()), [getUserName])

  const dropdownItems = useMemo(
    () => [
      {
        label: t('chat.save'),
        key: 'save',
        icon: <SaveOutlined />,
        onClick: () => {
          const fileName = message.createdAt + '.md'
          window.api.saveFile(fileName, message.content)
        }
      }
    ],
    [t, message]
  )

  return (
    <MessageContainer key={message.id} className="message" style={{ border: messageBorder }}>
      <MessageHeader>
        <AvatarWrapper>
          {isAssistantMessage ? (
            <Avatar src={avatarSource} size={35}>
              {avatarName}
            </Avatar>
          ) : (
            <Avatar src={avatar} size={35} />
          )}
          <UserWrap>
            <UserName>{username}</UserName>
            <MessageTime>{dayjs(message.createdAt).format('MM/DD HH:mm')}</MessageTime>
          </UserWrap>
        </AvatarWrapper>
      </MessageHeader>
      <MessageContent style={{ fontFamily }}>
        {message.status === 'sending' && (
          <MessageContentLoading>
            <SyncOutlined spin size={24} />
          </MessageContentLoading>
        )}
        {message.status !== 'sending' && <Markdown message={message} />}
        {message.usage && !generating && (
          <MessageMetadata>
            Tokens: {message.usage.total_tokens} | ↑{message.usage.prompt_tokens}↓{message.usage.completion_tokens}
          </MessageMetadata>
        )}
        {showMenu && (
          <MenusBar className={`menubar ${isLastMessage && 'show'} ${(!isLastMessage || isUserMessage) && 'user'}`}>
            {message.role === 'user' && (
              <Tooltip title="Edit" mouseEnterDelay={0.8}>
                <ActionButton onClick={onEdit}>
                  <EditOutlined />
                </ActionButton>
              </Tooltip>
            )}
            <Tooltip title={t('common.copy')} mouseEnterDelay={0.8}>
              <ActionButton onClick={onCopy}>
                {!copied && <CopyOutlined />}
                {copied && <CheckOutlined style={{ color: 'var(--color-primary)' }} />}
              </ActionButton>
            </Tooltip>
            <Tooltip title={t('common.delete')} mouseEnterDelay={0.8}>
              <ActionButton onClick={onDelete}>
                <DeleteOutlined />
              </ActionButton>
            </Tooltip>
            {canRegenerate && (
              <Tooltip title={t('common.regenerate')} mouseEnterDelay={0.8}>
                <ActionButton onClick={onRegenerate}>
                  <SyncOutlined />
                </ActionButton>
              </Tooltip>
            )}
            {!isUserMessage && (
              <Dropdown menu={{ items: dropdownItems }} trigger={['click']} placement="topRight" arrow>
                <ActionButton>
                  <MenuOutlined />
                </ActionButton>
              </Dropdown>
            )}
          </MenusBar>
        )}
      </MessageContent>
    </MessageContainer>
  )
}

const MessageContainer = styled.div`
  display: flex;
  flex-direction: column;
  padding: 10px 20px;
  position: relative;
  border-bottom: 0.5px dotted var(--color-border);
  .menubar {
    opacity: 0;
    transition: opacity 0.2s ease;
    &.show {
      opacity: 1;
    }
    &.user {
      position: absolute;
      top: 15px;
      right: 10px;
    }
  }
  &:hover {
    .menubar {
      opacity: 1;
    }
  }
`

const MessageHeader = styled.div`
  margin-right: 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-bottom: 4px;
  justify-content: space-between;
`

const AvatarWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`

const UserWrap = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  margin-left: 12px;
`

const UserName = styled.div`
  font-size: 14px;
  font-weight: 600;
`

const MessageTime = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
`

const MessageContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  margin-left: 46px;
  margin-top: 5px;
`

const MessageContentLoading = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 32px;
`

const MenusBar = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
`

const MessageMetadata = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
  user-select: text;
`

const ActionButton = styled.div`
  cursor: pointer;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  width: 30px;
  height: 30px;
  .anticon {
    cursor: pointer;
    font-size: 14px;
    color: var(--color-icon);
  }
  &:hover {
    color: var(--color-text-1);
  }
`

export default memo(MessageItem)
