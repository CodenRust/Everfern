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

export default function LearnPage() {
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
            Understanding Global Warming
          </motion.h1>

          <motion.p
            variants={fadeIn}
            className="max-w-3xl mx-auto text-lg text-gray-600 leading-relaxed"
          >
            Global warming is the long-term rise in Earth's average temperature due to human activities, primarily the burning of fossil fuels and deforestation.
            <br />
            Understanding the science behind it is crucial for taking meaningful action.
          </motion.p>
        </motion.div>

        {/* What is Global Warming */}
        <motion.section variants={fadeIn} className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12 border border-gray-100">
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="text-2xl md:text-4xl font-bold text-gray-900 mb-6"
          >
            What is Global Warming?
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            viewport={{ once: true }}
            className="text-gray-600 mb-6 leading-relaxed text-lg"
          >
            Global warming refers to the gradual increase in Earth's average surface temperature, primarily caused by the increase in greenhouse gases in the atmosphere.
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            viewport={{ once: true }}
            className="bg-gray-50 rounded-xl p-6 mb-6"
          >
            <h3 className="font-semibold text-gray-800 mb-4">Key Points:</h3>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-3">
                <span className="text-blue-600 mt-1">•</span>
                <span><strong>Greenhouse Effect:</strong> Natural process where gases like CO₂ trap heat in the atmosphere, keeping Earth warm enough for life.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 mt-1">•</span>
                <span><strong>Enhanced Effect:</strong> Human activities (burning fossil fuels, deforestation) increase greenhouse gases, trapping more heat.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-blue-600 mt-1">•</span>
                <span><strong>Result:</strong> Earth's average temperature has risen by about 1.2°C since pre-industrial times.</span>
              </li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            viewport={{ once: true }}
            className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500"
          >
            <h3 className="font-semibold text-blue-800 mb-3">Why It Matters:</h3>
            <p className="text-blue-700 leading-relaxed">
              Even small temperature increases lead to significant changes in climate patterns, weather events, and ecosystems.
              <br />
              The 1.5°C threshold is critical — crossing it risks irreversible damage to our planet.
            </p>
          </motion.div>
        </motion.section>

        {/* Causes */}
        <motion.section variants={fadeIn} className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12 border border-gray-100">
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="text-2xl md:text-4xl font-bold text-gray-900 mb-6"
          >
            Main Causes of Global Warming
          </motion.h2>

          <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Fossil Fuels */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-red-50 rounded-xl p-6 border border-red-100"
            >
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Burning Fossil Fuels</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Coal, oil, and natural gas release CO₂ when burned for energy. This accounts for ~75% of global greenhouse gas emissions.
              </p>
            </motion.div>

            {/* Deforestation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              viewport={{ once: true }}
              className="bg-green-50 rounded-xl p-6 border border-green-100"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Deforestation</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Trees absorb CO₂. Cutting them down releases stored carbon and reduces Earth's capacity to absorb new emissions.
              </p>
            </motion.div>

            {/* Agriculture */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
              className="bg-amber-50 rounded-xl p-6 border border-amber-100"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Agriculture & Livestock</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Methane from livestock and nitrous oxide from fertilizers are potent greenhouse gases.
              </p>
            </motion.div>

            {/* Industry */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              viewport={{ once: true }}
              className="bg-gray-50 rounded-xl p-6 border border-gray-100"
            >
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Industrial Processes</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Manufacturing cement, steel, and chemicals releases significant CO₂ and other greenhouse gases.
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            viewport={{ once: true }}
            className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500"
          >
            <h3 className="font-semibold text-blue-800 mb-3">The Bottom Line:</h3>
            <p className="text-blue-700 leading-relaxed">
              Human activities are the primary driver of recent global warming. The good news? We have the power to change course.
            </p>
          </motion.div>
        </motion.section>

        {/* Impacts */}
        <motion.section variants={fadeIn} className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12 border border-gray-100">
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="text-2xl md:text-4xl font-bold text-gray-900 mb-6"
          >
            Impacts We're Already Seeing
          </motion.h2>

          <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Temperature Rise */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-red-50 rounded-xl p-6 border border-red-100"
            >
              <div className="text-4xl font-bold text-red-600 mb-4">+1.2°C</div>
              <h3 className="font-semibold text-gray-900 mb-3">Global Temperature Rise</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Since pre-industrial times. The last decade was the hottest on record. Heatwaves are becoming more frequent and intense.
              </p>
            </motion.div>

            {/* Melting Ice */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              viewport={{ once: true }}
              className="bg-blue-50 rounded-xl p-6 border border-blue-100"
            >
              <div className="text-4xl font-bold text-blue-600 mb-4">↓ 12.5%</div>
              <h3 className="font-semibold text-gray-900 mb-3">Arctic Sea Ice</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Lost per decade since 1980. Greenland and Antarctic ice sheets are melting at accelerating rates.
              </p>
            </motion.div>

            {/* Sea Level Rise */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
              className="bg-amber-50 rounded-xl p-6 border border-amber-100"
            >
              <div className="text-4xl font-bold text-amber-600 mb-4">+10cm</div>
              <h3 className="font-semibold text-gray-900 mb-3">Sea Level Rise</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Since 1993. Threatening coastal communities and ecosystems. By 2100, could rise by 0.3-1m.
              </p>
            </motion.div>

            {/* Extreme Weather */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              viewport={{ once: true }}
              className="bg-gray-50 rounded-xl p-6 border border-gray-100"
            >
              <div className="text-4xl font-bold text-gray-600 mb-4">×3</div>
              <h3 className="font-semibold text-gray-900 mb-3">Extreme Weather Events</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Since 1980. Heatwaves, floods, hurricanes, and wildfires are becoming more frequent and severe.
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            viewport={{ once: true }}
            className="bg-gray-50 rounded-xl p-6 border-l-4 border-gray-500"
          >
            <h3 className="font-semibold text-gray-800 mb-3">The Science is Clear:</h3>
            <p className="text-gray-700 leading-relaxed">
              These changes are directly linked to human-caused global warming. The impacts are global, affecting every ecosystem and community.
            </p>
          </motion.div>
        </motion.section>

        {/* Solutions */}
        <motion.section variants={fadeIn} className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12 border border-gray-100">
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="text-2xl md:text-4xl font-bold text-gray-900 mb-6"
          >
            Solutions Within Reach
          </motion.h2>

          <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Renewable Energy */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-blue-50 rounded-xl p-6 border border-blue-100"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Renewable Energy</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Solar, wind, and hydro power are now cheaper than fossil fuels in most places. Transitioning energy systems is key.
              </p>
            </motion.div>

            {/* Energy Efficiency */}
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
              <h3 className="font-semibold text-gray-900 mb-3">Energy Efficiency</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Upgrading buildings, appliances, and industrial processes can cut energy use by 30-50% with existing technology.
              </p>
            </motion.div>

            {/* Reforestation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
              className="bg-amber-50 rounded-xl p-6 border border-amber-100"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Reforestation</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Restoring forests captures CO₂ from the atmosphere. Nature-based solutions can provide 30% of needed emissions reductions.
              </p>
            </motion.div>

            {/* Policy & Innovation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              viewport={{ once: true }}
              className="bg-gray-50 rounded-xl p-6 border border-gray-100"
            >
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Policy & Innovation</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Carbon pricing, clean energy incentives, and technological innovation are accelerating the transition to a zero-carbon economy.
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            viewport={{ once: true }}
            className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500"
          >
            <h3 className="font-semibold text-blue-800 mb-3">The Path Forward:</h3>
            <p className="text-blue-700 leading-relaxed">
              We have the technology and economic tools to solve this crisis. What's needed is the political will and collective action.
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