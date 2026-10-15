import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)

// Путь к файлу с заблокированными IP
// В Docker контейнере используем /app/data (volume), на хосте - /opt/ollenti/blocked-ips
const BLOCKED_IPS_FILE = process.env.BLOCKED_IPS_FILE ||
  (process.env.NODE_ENV === 'production' ? '/app/data/blocked-ips.txt' : '/opt/ollenti/blocked-ips/blocked-ips.txt')

// Создаем файл если его нет
if (!fs.existsSync(BLOCKED_IPS_FILE)) {
  try {
    fs.mkdirSync(path.dirname(BLOCKED_IPS_FILE), { recursive: true })
    fs.writeFileSync(BLOCKED_IPS_FILE, '', 'utf-8')
  } catch (error) {
    console.error('Failed to create blocked IPs file:', error)
  }
}

// Загрузка списка заблокированных IP
function loadBlockedIPs(): Set<string> {
  try {
    if (!fs.existsSync(BLOCKED_IPS_FILE)) {
      return new Set()
    }
    const content = fs.readFileSync(BLOCKED_IPS_FILE, 'utf-8')
    const ips = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
    return new Set(ips)
  } catch (error) {
    console.error('Failed to load blocked IPs:', error)
    return new Set()
  }
}

// Сохранение списка заблокированных IP
function saveBlockedIPs(ips: Set<string>): void {
  try {
    const content = Array.from(ips).join('\n') + '\n'
    fs.writeFileSync(BLOCKED_IPS_FILE, content, 'utf-8')
  } catch (error) {
    console.error('Failed to save blocked IPs:', error)
  }
}

// Проверка валидности IP адреса
function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
  return ipv4Regex.test(ip) || ipv6Regex.test(ip)
}

// Блокировка IP через iptables (только если доступен sudo на хосте)
async function blockIPInIptables(ip: string): Promise<boolean> {
  try {
    // Проверяем что IP валидный
    if (!isValidIP(ip)) {
      console.error(`Invalid IP address: ${ip}`)
      return false
    }

    // В Docker контейнере iptables недоступен напрямую
    // Используем альтернативный метод через скрипт на хосте или просто логируем
    // Блокировка на уровне приложения уже работает через middleware

    // Пытаемся выполнить через sudo (работает только если контейнер имеет доступ к хосту)
    const command = process.env.IPTABLES_COMMAND || `sudo iptables -I INPUT -s ${ip} -j DROP`

    try {
      await execAsync(command, { timeout: 5000 })
      console.log(`✅ IP ${ip} blocked in iptables`)
      return true
    } catch (error: any) {
      // Если команда недоступна (в Docker), это нормально - блокируем только на уровне приложения
      if (error.message && (
        error.message.includes('command not found') ||
        error.message.includes('Permission denied') ||
        error.message.includes('Cannot find module')
      )) {
        console.log(`⚠️ iptables недоступен, блокировка только на уровне приложения для IP ${ip}`)
        return true // Возвращаем true, так как блокировка на уровне приложения работает
      }

      // Если правило уже существует, это нормально
      if (error.message && error.message.includes('already exists')) {
        console.log(`IP ${ip} already blocked`)
        return true
      }

      console.warn(`Failed to block IP ${ip} in iptables (will block at app level):`, error.message)
      return true // Все равно блокируем на уровне приложения
    }
  } catch (error) {
    console.error(`Error blocking IP ${ip}:`, error)
    return true // Блокируем на уровне приложения в любом случае
  }
}

// Разблокировка IP из iptables
async function unblockIPInIptables(ip: string): Promise<boolean> {
  try {
    if (!isValidIP(ip)) {
      return false
    }

    // Удаляем правило DROP для этого IP
    const command = process.env.IPTABLES_COMMAND_UNBLOCK || `sudo iptables -D INPUT -s ${ip} -j DROP`

    try {
      await execAsync(command, { timeout: 5000 })
      console.log(`✅ IP ${ip} unblocked in iptables`)
      return true
    } catch (error: any) {
      // Если команда недоступна, это нормально
      if (error.message && (
        error.message.includes('command not found') ||
        error.message.includes('Permission denied')
      )) {
        console.log(`⚠️ iptables недоступен для разблокировки IP ${ip}`)
        return true
      }

      // Если правила нет, это нормально
      if (error.message && error.message.includes('No chain')) {
        console.log(`IP ${ip} was not blocked`)
        return true
      }
      console.warn(`Failed to unblock IP ${ip} in iptables:`, error.message)
      return true // Разблокируем на уровне приложения в любом случае
    }
  } catch (error) {
    console.error(`Error unblocking IP ${ip}:`, error)
    return true // Разблокируем на уровне приложения
  }
}

// Блокировка IP адреса
export async function blockIP(ip: string): Promise<{ success: boolean; message: string }> {
  try {
    // Проверяем валидность IP
    if (!isValidIP(ip)) {
      return { success: false, message: `❌ Неверный формат IP адреса: ${ip}` }
    }

    // Загружаем текущий список
    const blockedIPs = loadBlockedIPs()

    // Проверяем, не заблокирован ли уже
    if (blockedIPs.has(ip)) {
      return { success: false, message: `⚠️ IP ${ip} уже заблокирован` }
    }

    // Блокируем в iptables
    const iptablesSuccess = await blockIPInIptables(ip)
    if (!iptablesSuccess) {
      return { success: false, message: `❌ Не удалось заблокировать IP ${ip} в iptables` }
    }

    // Добавляем в список
    blockedIPs.add(ip)
    saveBlockedIPs(blockedIPs)

    // Сохраняем правила iptables для автозагрузки (только если доступно)
    try {
      const saveCommand = process.env.IPTABLES_SAVE_COMMAND ||
        'sudo netfilter-persistent save || sudo iptables-save | sudo tee /etc/iptables/rules.v4'
      await execAsync(saveCommand, { timeout: 5000 })
    } catch (error) {
      // В Docker контейнере это нормально
      console.warn('Failed to save iptables rules (normal in Docker):', error instanceof Error ? error.message : error)
    }

    return { success: true, message: `✅ IP адрес ${ip} успешно заблокирован` }
  } catch (error) {
    console.error('Error blocking IP:', error)
    return { success: false, message: `❌ Ошибка при блокировке IP: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

// Разблокировка IP адреса
export async function unblockIP(ip: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!isValidIP(ip)) {
      return { success: false, message: `❌ Неверный формат IP адреса: ${ip}` }
    }

    const blockedIPs = loadBlockedIPs()

    if (!blockedIPs.has(ip)) {
      return { success: false, message: `⚠️ IP ${ip} не был заблокирован` }
    }

    // Разблокируем в iptables
    const iptablesSuccess = await unblockIPInIptables(ip)
    if (!iptablesSuccess) {
      return { success: false, message: `❌ Не удалось разблокировать IP ${ip} в iptables` }
    }

    // Удаляем из списка
    blockedIPs.delete(ip)
    saveBlockedIPs(blockedIPs)

    // Сохраняем правила (только если доступно)
    try {
      const saveCommand = process.env.IPTABLES_SAVE_COMMAND ||
        'sudo netfilter-persistent save || sudo iptables-save | sudo tee /etc/iptables/rules.v4'
      await execAsync(saveCommand, { timeout: 5000 })
    } catch (error) {
      // В Docker контейнере это нормально
      console.warn('Failed to save iptables rules (normal in Docker):', error instanceof Error ? error.message : error)
    }

    return { success: true, message: `✅ IP адрес ${ip} успешно разблокирован` }
  } catch (error) {
    console.error('Error unblocking IP:', error)
    return { success: false, message: `❌ Ошибка при разблокировке IP: ${error instanceof Error ? error.message : 'Unknown error'}` }
  }
}

// Получение списка заблокированных IP
export function getBlockedIPs(): string[] {
  const blockedIPs = loadBlockedIPs()
  return Array.from(blockedIPs)
}

// Проверка, заблокирован ли IP
export function isIPBlocked(ip: string): boolean {
  const blockedIPs = loadBlockedIPs()
  return blockedIPs.has(ip)
}

// Извлечение IP адреса из текста
export function extractIPFromText(text: string): string | null {
  // Ищем IP адрес в формате IPv4
  const ipv4Regex = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/
  const match = text.match(ipv4Regex)
  return match ? match[1] : null
}
