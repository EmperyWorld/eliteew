import React, { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { Card } from '@components/atoms/Card'
import { Button } from '@components/atoms/Button'
import { Input } from '@components/atoms/Input'

interface PasswordSettingsProps {
  onChangePassword: (current: string, newPass: string) => Promise<boolean>
}

export const PasswordSettings: React.FC<PasswordSettingsProps> = ({ onChangePassword }) => {
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showPasswords, setShowPasswords] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Пароли не совпадают')
      return
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('Пароль должен быть не менее 6 символов')
      return
    }

    setIsChangingPassword(true)
    const success = await onChangePassword(passwordData.currentPassword, passwordData.newPassword)
    setIsChangingPassword(false)

    if (success) {
      setPasswordSuccess('Пароль успешно изменён')
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setTimeout(() => setPasswordSuccess(''), 3000)
    } else {
      setPasswordError('Неверный текущий пароль')
    }
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-amber-100">
          <Lock size={20} className="text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold text-neutral-900">Смена пароля</h2>
      </div>

      <form onSubmit={handlePasswordChange} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Текущий пароль
            </label>
            <div className="relative">
              <Input
                type={showPasswords ? 'text' : 'password'}
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Новый пароль
            </label>
            <Input
              type={showPasswords ? 'text' : 'password'}
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Подтвердите пароль
            </label>
            <Input
              type={showPasswords ? 'text' : 'password'}
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPasswords(!showPasswords)}
            className="text-sm text-neutral-500 hover:text-neutral-700 flex items-center gap-1"
          >
            {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
            {showPasswords ? 'Скрыть пароли' : 'Показать пароли'}
          </button>
        </div>

        {passwordError && (
          <div className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-xl">
            {passwordError}
          </div>
        )}

        {passwordSuccess && (
          <div className="text-green-600 text-sm bg-green-50 px-4 py-2 rounded-xl">
            {passwordSuccess}
          </div>
        )}

        <Button
          type="submit"
          variant="outline"
          disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword}
        >
          <Lock size={16} className="mr-2" />
          {isChangingPassword ? 'Сохранение...' : 'Изменить пароль'}
        </Button>
      </form>
    </Card>
  )
}
