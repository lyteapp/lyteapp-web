'use client'

import { useState, useEffect } from 'react'

const COUNTRIES = [
  { code: '+58',  name: 'Venezuela' },
  { code: '+57',  name: 'Colombia' },
  { code: '+52',  name: 'México' },
  { code: '+54',  name: 'Argentina' },
  { code: '+56',  name: 'Chile' },
  { code: '+51',  name: 'Perú' },
  { code: '+593', name: 'Ecuador' },
  { code: '+591', name: 'Bolivia' },
  { code: '+595', name: 'Paraguay' },
  { code: '+598', name: 'Uruguay' },
  { code: '+53',  name: 'Cuba' },
  { code: '+507', name: 'Panamá' },
  { code: '+506', name: 'Costa Rica' },
  { code: '+502', name: 'Guatemala' },
  { code: '+504', name: 'Honduras' },
  { code: '+503', name: 'El Salvador' },
  { code: '+505', name: 'Nicaragua' },
  { code: '+1',   name: 'USA / Puerto Rico' },
  { code: '+34',  name: 'España' },
]

const CODES_SORTED = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length)

function parsePhone(raw: string): { code: string; local: string } {
  const digits = raw.replace(/\D/g, '')
  for (const c of CODES_SORTED) {
    const prefix = c.code.replace('+', '')
    if (digits.startsWith(prefix)) {
      return { code: c.code, local: digits.slice(prefix.length) }
    }
  }
  return { code: '+58', local: digits }
}

interface Props {
  value: string
  onChange: (full: string) => void
  placeholder?: string
  inputClassName?: string
  wrapClassName?: string
}

export default function PhoneInput({ value, onChange, placeholder = '4141234567', inputClassName = '', wrapClassName = '' }: Props) {
  const parsed = parsePhone(value)
  const [code, setCode] = useState(parsed.code)
  const [local, setLocal] = useState(parsed.local)

  useEffect(() => {
    const p = parsePhone(value)
    setCode(p.code)
    setLocal(p.local)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function emit(newCode: string, newLocal: string) {
    const full = newCode.replace('+', '') + newLocal.replace(/\D/g, '')
    onChange(full)
  }

  function handleCodeChange(newCode: string) {
    setCode(newCode)
    emit(newCode, local)
  }

  function handleLocalChange(v: string) {
    setLocal(v)
    emit(code, v)
  }

  return (
    <div className={`pi-wrap ${wrapClassName}`}>
      <div className="pi-select-wrap">
        <select
          className="pi-select"
          value={code}
          onChange={e => handleCodeChange(e.target.value)}
        >
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.code}>
              {c.code} {c.name}
            </option>
          ))}
        </select>
        <svg className="pi-chevron" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>
      <input
        type="tel"
        inputMode="numeric"
        value={local}
        onChange={e => handleLocalChange(e.target.value)}
        placeholder={placeholder}
        className={`pi-input ${inputClassName}`}
      />
    </div>
  )
}
