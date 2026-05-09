import { motion } from 'framer-motion'
import Link from 'next/link'

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

export default function Home() {
  return (
    <motion.main
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-amber-50"
    >
      {/* Hero Section */}
      <motion.section
        variants={fadeIn}
        className="container mx-auto px-6 py-20 md:py-32 text-center"
      >
        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 10, stiffness: 100 }}
          className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 mb-6 leading-tight"
        >
          Our Planet is Warming.
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-amber-600">
            What will we do?
          </span>
        </motion.h1>

        <motion.p
          variants={fadeIn}
          className="max-w-2xl mx-auto text-lg md:text-xl text-gray-600 mb-10 leading-relaxed"
        >
          Global warming is reshaping our world. Rising temperatures, extreme weather, and ecosystem collapse threaten our future.
          <br />
          But together, we can turn the tide.
        </motion.p>

        <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/learn"
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-105"
          >
            Learn the Science
          </Link>
          <Link
            href="/take-action"
            className="px-8 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-105"
          >
            Take Action
          </Link>
        </motion.div>
      </motion.section>

      {/* Impact Section */}
      <motion.section
        variants={fadeIn}
        className="bg-gray-900 text-white py-20 md:py-24"
      >
        <div className="container mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold mb-4 text-center"
          >
            The Reality We Face
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-lg text-gray-300 mb-16 text-center leading-relaxed"
          >
            From melting ice caps to intensifying storms, global warming is not a distant threat — it's happening now.
            <br />
            Understanding the impacts is the first step toward meaningful change.
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {/* Temperature Rise */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              viewport={{ once: true }}
              className="bg-gray-800 p-8 rounded-2xl border border-gray-700 hover:border-blue-500 transition-all duration-300"
            >
              <div className="text-5xl font-bold text-blue-400 mb-4">+1.2°C</div>
              <h3 className="text-xl font-semibold mb-3">Global Temperature Rise</h3>
              <p className="text-gray-400">Since pre-industrial times. We're halfway to the 1.5°C danger threshold.</p>
            </motion.div>

            {/* CO2 Levels */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
              className="bg-gray-800 p-8 rounded-2xl border border-gray-700 hover:border-amber-500 transition-all duration-300"
            >
              <div className="text-5xl font-bold text-amber-400 mb-4">424 ppm</div>
              <h3 className="text-xl font-semibold mb-3">Atmospheric CO₂</h3>
              <p className="text-gray-400">Highest in human history. Rising faster than ever before.</p>
            </motion.div>

            {/* Extreme Weather */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              viewport={{ once: true }}
              className="bg-gray-800 p-8 rounded-2xl border border-gray-700 hover:border-red-500 transition-all duration-300"
            >
              <div className="text-5xl font-bold text-red-400 mb-4">×3</div>
              <h3 className="text-xl font-semibold mb-3">Extreme Weather Events</h3>
              <p className="text-gray-400">Since 1980. Heatwaves, floods, and hurricanes are becoming the new normal.</p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <Link
              href="/impacts"
              className="inline-block px-8 py-4 bg-gradient-to-r from-gray-700 to-gray-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              Explore the Impacts →
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* Solutions Section */}
      <motion.section
        variants={fadeIn}
        className="py-20 md:py-24 bg-gradient-to-br from-blue-50 to-white"
      >
        <div className="container mx-auto px-6">
          <motion.h2
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold mb-4 text-center text-gray-900"
          >
            Solutions Exist. We Must Act.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-lg text-gray-600 mb-16 text-center leading-relaxed"
          >
            From renewable energy to sustainable living, solutions are within reach.
            <br />
            It's time to build a cleaner, healthier future — together.
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            {/* Renewable Energy */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-6 mx-auto">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">Renewable Energy</h3>
              <p className="text-gray-600">Solar, wind, and hydro power are now cheaper than fossil fuels in most places.</p>
            </motion.div>

            {/* Sustainable Transport */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300"
            >
              <div className="w-16 h-16 bg-amber-100 rounded-xl flex items-center justify-center mb-6 mx-auto">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">Sustainable Transport</h3>
              <p className="text-gray-600">Electric vehicles, biking, and public transit can cut emissions by over 50%.</p>
            </motion.div>

            {/* Circular Economy */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              viewport={{ once: true }}
              className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300"
            >
              <div className="w-16 h-16 bg-green-100 rounded-xl flex items-center justify-center mb-6 mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.586a1 1 0 01.707 1.707l-4.586 4.586a1 1 0 01-1.414 0l-4.586-4.586a1 1 0 011.414-1.707M14 6h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V7a1 1 0 011-1z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900">Circular Economy</h3>
              <p className="text-gray-600">Reduce waste by designing products to be reused, repaired, and recycled.</p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <Link
              href="/solutions"
              className="inline-block px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              Discover Solutions →
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        variants={fadeIn}
        className="py-20 md:py-24 bg-gray-900 text-white"
      >
        <div className="container mx-auto px-6 text-center">
          <motion.h2
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 10, stiffness: 100 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold mb-6"
          >
            The Time to Act is Now
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-lg text-gray-300 mb-10 leading-relaxed"
          >
            Every choice matters. Every action counts.
            <br />
            Join millions taking steps toward a sustainable future.
          </motion.p>

          <motion.div variants={fadeIn} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/take-action"
              className="px-8 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-105"
            >
              Take Action
            </Link>
            <Link
              href="/community"
              className="px-8 py-4 bg-gradient-to-r from-gray-700 to-gray-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-105"
            >
              Join the Movement
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        viewport={{ once: true }}
        className="bg-gray-900 border-t border-gray-800 py-12"
      >
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <h3 className="text-xl font-bold text-white mb-2">Global Warming Info</h3>
              <p className="text-gray-400">Building a sustainable future, one choice at a time.</p>
            </div>
            <div className="flex gap-6">
              <Link href="/about" className="text-gray-400 hover:text-white transition-colors">About</Link>
              <Link href="/contact" className="text-gray-400 hover:text-white transition-colors">Contact</Link>
              <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy</Link>
            </div>
          </div>
          <div className="text-center text-gray-500 text-sm mt-8">
            © {new Date().getFullYear()} Global Warming Info. All rights reserved.
          </div>
        </div>
      </motion.footer>
    </motion.main>
  )
}