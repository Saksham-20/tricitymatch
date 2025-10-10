import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

const Layout = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-peach via-warm-cream to-warm-lavender">
      <Navbar />
      <main className="pb-8">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
