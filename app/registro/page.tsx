'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Registro() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mensaje, setMensaje] = useState('')

  async function handleRegistro() {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setMensaje('Error: ' + error.message)
    } else {
      setMensaje('¡Cuenta creada! Revisa tu email para confirmar.')
    }
  }

  return (
    <div style={{ padding: '40px', maxWidth: '400px', margin: '0 auto' }}>
      <h1>Crear cuenta</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: '12px', padding: '8px' }}
      />
      <input
        type="password"
        placeholder="Contraseña"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ display: 'block', width: '100%', marginBottom: '12px', padding: '8px' }}
      />
      <button onClick={handleRegistro} style={{ padding: '10px 20px' }}>
        Registrarse
      </button>
      {mensaje && <p style={{ marginTop: '16px' }}>{mensaje}</p>}
    </div>
  )
}
