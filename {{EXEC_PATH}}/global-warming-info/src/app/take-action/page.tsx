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

export default function TakeActionPage() {
  return (
    <motion.main
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-amber-50 py-20"
    >
      <div className="container mx-auto px-6">
        {/* Header */}
        <motion.div variants={fadeIn} className="text-center mb-16">
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 10, stiffness: 100 }}
            className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight"
          >
            Take Action Against Global Warming
          </motion.h1>

          <motion.p
            variants={fadeIn}
            className="max-w-3xl mx-auto text-lg text-gray-600 leading-relaxed"
          >
            Every choice matters. Every action counts. Together, we can make a difference in the fight against climate change.
          </motion.p>
        </motion.div>

        {/* Personal Actions */}
        <motion.section variants={fadeIn} className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12 border border-gray-100">
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="text-2xl md:text-4xl font-bold text-gray-900 mb-6"
          >
            Personal Actions That Make a Difference
          </motion.h2>

          <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Energy at Home */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-blue-50 rounded-xl p-6 border border-blue-100"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Energy at Home</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Switch to LED bulbs, unplug devices when not in use, and upgrade to energy-efficient appliances. Small changes add up to big savings.
              </p>
            </motion.div>

            {/* Sustainable Transport */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              viewport={{ once: true }}
              className="bg-amber-50 rounded-xl p-6 border border-amber-100"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Sustainable Transport</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Walk, bike, carpool, or use public transit. If you need a car, consider an electric vehicle. Every mile not driven in a gas car saves ~0.4 lbs of CO₂.
              </p>
            </motion.div>

            {/* Reduce Waste */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
              className="bg-green-50 rounded-xl p-6 border border-green-100"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Reduce Waste</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Buy less, choose reusable over disposable, and recycle properly. Food waste alone accounts for ~8% of global emissions.
              </p>
            </motion.div>

            {/* Eat Green */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              viewport={{ once: true }}
              className="bg-gray-50 rounded-xl p-6 border border-gray-100"
            >
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Eat Green</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Reduce meat consumption, especially beef. Plant-based meals have a much lower carbon footprint. Try "Meatless Mondays" or similar initiatives.
              </p>
            </motion.div>

            {/* Support Green Businesses */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              viewport={{ once: true }}
              className="bg-blue-50 rounded-xl p-6 border border-blue-100 md:col-span-2"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Support Green Businesses</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Choose companies committed to sustainability. Your purchasing power sends a message about the future you want to see.
              </p>
            </motion.div>

            {/* Vote & Advocate */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              viewport={{ once: true }}
              className="bg-amber-50 rounded-xl p-6 border border-amber-100 md:col-span-2"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Vote & Advocate</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Support leaders who prioritize climate action. Join local environmental groups, sign petitions, and contact your representatives regularly.
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            viewport={{ once: true }}
            className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500"
          >
            <h3 className="font-semibold text-blue-800 mb-3">Remember:</h3>
            <p className="text-blue-700 leading-relaxed">
              You don't have to do everything. Start with what feels manageable. Consistency matters more than perfection.
            </p>
          </motion.div>
        </motion.section>

        {/* Community Actions */}
        <motion.section variants={fadeIn} className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12 border border-gray-100">
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="text-2xl md:text-4xl font-bold text-gray-900 mb-6"
          >
            Collective Action for Greater Impact
          </motion.h2>

          <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Community Gardens */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-green-50 rounded-xl p-6 border border-green-100"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Community Gardens</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Grow food locally to reduce transport emissions and build community resilience. Every pound of homegrown food avoids emissions from industrial agriculture.
              </p>
            </motion.div>

            {/* Cleanup Events */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              viewport={{ once: true }}
              className="bg-blue-50 rounded-xl p-6 border border-blue-100"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Cleanup Events</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Join local beach, park, or neighborhood cleanups. Removing waste prevents pollution and protects wildlife. Organize your own cleanup if none exists.
              </p>
            </motion.div>

            {/* Tree Planting */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
              className="bg-amber-50 rounded-xl p-6 border border-amber-100 md:col-span-2"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Tree Planting</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Trees absorb CO₂ and provide habitat. One tree can absorb ~48 lbs of CO₂ per year. Join or organize tree planting initiatives in your area.
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            viewport={{ once: true }}
            className="bg-green-50 rounded-xl p-6 border-l-4 border-green-500"
          >
            <h3 className="font-semibold text-green-800 mb-3">Together We're Stronger:</h3>
            <p className="text-green-700 leading-relaxed">
              Collective action creates systemic change. Your voice and participation amplify the impact of your individual actions.
            </p>
          </motion.div>
        </motion.section>

        {/* Tools & Resources */}
        <motion.section variants={fadeIn} className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12 border border-gray-100">
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="text-2xl md:text-4xl font-bold text-gray-900 mb-6"
          >
            Tools & Resources to Help You Act
          </motion.h2>

          <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Carbon Footprint Calculator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-blue-50 rounded-xl p-6 border border-blue-100"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Carbon Footprint Calculator</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Calculate your personal carbon footprint and get personalized recommendations for reduction. Tools like <a href="https://www.carbonfootprint.com/calculator.aspx" className="text-blue-600 hover:underline">Carbon Footprint</a> or <a href="https://www.footprintcalculator.org/" className="text-blue-600 hover:underline">Global Footprint Network</a> can help.
              </p>
            </motion.div>

            {/* Climate Action Tracker */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              viewport={{ once: true }}
              className="bg-green-50 rounded-xl p-6 border border-green-100"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Climate Action Tracker</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Track global progress on climate commitments. See which countries are on track and where action is needed most. Visit <a href="https://climateactiontracker.org/" className="text-green-600 hover:underline">climateactiontracker.org</a>.
              </p>
            </motion.div>

            {/* Local Groups */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
              className="bg-amber-50 rounded-xl p-6 border border-amber-100 md:col-span-2"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Local Groups</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Find local environmental groups working on climate issues in your area. Organizations like <a href="https://www.350.org/" className="text-amber-600 hover:underline">350.org</a>, <a href="https://www.sierraclub.org/" className="text-amber-600 hover:underline">Sierra Club</a>, or <a href="https://www.nature.org/" className="text-amber-600 hover:underline">The Nature Conservancy</a> often have local chapters.
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            viewport={{ once: true }}
            className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500 text-center"
          >
            <h3 className="font-semibold text-blue-800 mb-3">You're Not Alone:</h3>
            <p className="text-blue-700 leading-relaxed">
              Millions of people worldwide are taking action. Join them and be part of the solution.
            </p>
          </motion.div>
        </motion.section>

        {/* Back to Home */}
        <motion.div variants={fadeIn} className="text-center mt-16">
          <Link
            href="/"
            className="inline-block px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
          >
            ← Back to Home
          </Link>
        </motion.div>
      </div>
    </motion.main>
  )
}