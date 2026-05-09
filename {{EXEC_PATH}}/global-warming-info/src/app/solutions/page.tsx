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

export default function SolutionsPage() {
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
            Climate Solutions That Work
          </motion.h1>

          <motion.p
            variants={fadeIn}
            className="max-w-3xl mx-auto text-lg text-gray-600 leading-relaxed"
          >
            From renewable energy to sustainable agriculture, solutions exist today. The question is: will we implement them fast enough?
          </motion.p>
        </motion.div>

        {/* Energy Transition */}
        <motion.section variants={fadeIn} className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12 border border-gray-100">
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="text-2xl md:text-4xl font-bold text-gray-900 mb-6"
          >
            The Energy Transition: Powering Our Future
          </motion.h2>

          <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Solar Power */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-amber-50 rounded-xl p-6 border border-amber-100"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Solar Power</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Solar energy is now the cheapest electricity in history. Rooftop solar can power homes while reducing grid demand. Community solar projects make it accessible to renters and those with shaded roofs.
              </p>
            </motion.div>

            {/* Wind Energy */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              viewport={{ once: true }}
              className="bg-blue-50 rounded-xl p-6 border border-blue-100"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M12 21V9M12 9L8 5m4 4l4-4m6 10a2 2 0 01-2 2H6a2 2 0 01-2-2v-6" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Wind Energy</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Onshore and offshore wind farms generate clean electricity at scale. Wind is now cheaper than coal in most places. Offshore wind has massive untapped potential, especially in coastal regions.
              </p>
            </motion.div>

            {/* Energy Storage */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
              className="bg-green-50 rounded-xl p-6 border border-green-100 md:col-span-2"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Energy Storage</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Batteries and other storage technologies store renewable energy for use when the sun isn't shining or wind isn't blowing. Costs have dropped 85% in the last decade, making 100% renewable grids feasible.
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            viewport={{ once: true }}
            className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500"
          >
            <h3 className="font-semibold text-blue-800 mb-3">The Bottom Line:</h3>
            <p className="text-blue-700 leading-relaxed">
              We have the technology to power our world with clean energy. The transition is not just possible — it's already happening at scale.
            </p>
          </motion.div>
        </motion.section>

        {/* Sustainable Transport Solutions */}
        <motion.section variants={fadeIn} className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12 border border-gray-100">
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="text-2xl md:text-4xl font-bold text-gray-900 mb-6"
          >
            Sustainable Transport: Moving Cleaner
          </motion.h2>

          <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Electric Vehicles */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-amber-50 rounded-xl p-6 border border-amber-100"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Electric Vehicles</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                EVs produce zero tailpipe emissions and can be powered by renewable energy. Battery costs have dropped 89% since 2010. By 2030, EVs could be cheaper than gas cars in most segments.
              </p>
            </motion.div>

            {/* Public Transit */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              viewport={{ once: true }}
              className="bg-blue-50 rounded-xl p-6 border border-blue-100"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Public Transit</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Buses, trains, and trams reduce emissions per passenger by 75-90% compared to cars. Electrifying transit systems and improving service can cut urban transport emissions dramatically.
              </p>
            </motion.div>

            {/* Active Transport */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
              className="bg-green-50 rounded-xl p-6 border border-green-100 md:col-span-2"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Active Transport</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Walking and cycling produce zero emissions and provide health benefits. Cities that invest in safe bike lanes and pedestrian infrastructure see dramatic increases in active transport use.
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
            <h3 className="font-semibold text-green-800 mb-3">The Path Forward:</h3>
            <p className="text-green-700 leading-relaxed">
              Sustainable transport isn't just about technology — it's about designing cities where people don't need cars. The solutions are proven and scalable.
            </p>
          </motion.div>
        </motion.section>

        {/* Sustainable Agriculture */}
        <motion.section variants={fadeIn} className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12 border border-gray-100">
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="text-2xl md:text-4xl font-bold text-gray-900 mb-6"
          >
            Sustainable Agriculture: Feeding the Future
          </motion.h2>

          <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Regenerative Farming */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-amber-50 rounded-xl p-6 border border-amber-100"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Regenerative Farming</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Practices like cover cropping, reduced tillage, and crop rotation build soil health, store carbon, and reduce emissions. Can sequester 1-2 gigatons of CO₂ per year globally.
              </p>
            </motion.div>

            {/* Plant-Based Diets */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              viewport={{ once: true }}
              className="bg-green-50 rounded-xl p-6 border border-green-100"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Plant-Based Diets</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Shifting to more plant-based diets can reduce food-related emissions by 50-70%. Livestock accounts for ~14.5% of global greenhouse gas emissions — more than all transportation combined.
              </p>
            </motion.div>

            {/* Food Waste Reduction */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
              className="bg-blue-50 rounded-xl p-6 border border-blue-100 md:col-span-2"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Food Waste Reduction</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                ~30% of food produced is wasted. Reducing waste cuts emissions from production, transport, and decomposition. Simple steps like better storage, meal planning, and composting make a big difference.
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            viewport={{ once: true }}
            className="bg-amber-50 rounded-xl p-6 border-l-4 border-amber-500"
          >
            <h3 className="font-semibold text-amber-800 mb-3">The Opportunity:</h3>
            <p className="text-amber-700 leading-relaxed">
              Sustainable agriculture can feed the world while drawing down carbon. It's not about producing less — it's about producing differently.
            </p>
          </motion.div>
        </motion.section>

        {/* Policy & Innovation */}
        <motion.section variants={fadeIn} className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12 border border-gray-100">
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="text-2xl md:text-4xl font-bold text-gray-900 mb-6"
          >
            Policy & Innovation: Accelerating Change
          </motion.h2>

          <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Carbon Pricing */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              viewport={{ once: true }}
              className="bg-blue-50 rounded-xl p-6 border border-blue-100"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Carbon Pricing</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Putting a price on carbon makes polluters pay and incentivizes clean alternatives. Over 40 countries and 3,000 companies have implemented carbon pricing. It's one of the most effective policies for reducing emissions.
              </p>
            </motion.div>

            {/* Clean Energy Incentives */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              viewport={{ once: true }}
              className="bg-green-50 rounded-xl p-6 border border-green-100"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Clean Energy Incentives</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Tax credits, grants, and feed-in tariffs have driven the renewable energy boom. The Inflation Reduction Act in the US alone is expected to cut emissions by 1 billion tons by 2030.
              </p>
            </motion.div>

            {/* Technological Innovation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
              className="bg-amber-50 rounded-xl p-6 border border-amber-100 md:col-span-2"
            >
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Technological Innovation</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                From next-generation batteries to direct air capture, innovation is accelerating. Breakthroughs in green hydrogen, next-gen solar, and carbon removal could transform our ability to address climate change.
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            viewport={{ once: true }}
            className="bg-blue-50 rounded-xl p-6 border-l-4 border-blue-500"
          >
            <h3 className="font-semibold text-blue-800 mb-3">The Power of Policy:</h3>
            <p className="text-blue-700 leading-relaxed">
              The right policies can accelerate the transition by years or decades. The technologies exist — what's needed is the political will to implement them at scale.
            </p>
          </motion.div>
        </motion.section>

        {/* Global Progress */}
        <motion.section variants={fadeIn} className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12 border border-gray-100">
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
            className="text-2xl md:text-4xl font-bold text-gray-900 mb-6"
          >
            Global Progress: The Race is On
          </motion.h2>

          <motion.div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Renewable Energy Growth */}
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
              <h3 className="font-semibold text-gray-900 mb-3">Renewable Energy Growth</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Solar and wind now account for ~12% of global electricity. In 2023 alone, 507 GW of new renewable capacity was added — more than fossil fuels and nuclear combined. Costs continue to plummet.
              </p>
            </motion.div>

            {/* EV Adoption */}
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
              <h3 className="font-semibold text-gray-900 mb-3">EV Adoption</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                EV sales grew 35% in 2023, reaching 14 million vehicles. Over 20 countries have committed to 100% zero-emission vehicle sales by 2035-2040. Battery costs are falling faster than expected.
              </p>
            </motion.div>

            {/* Corporate Commitments */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              viewport={{ once: true }}
              className="bg-green-50 rounded-xl p-6 border border-green-100 md:col-span-2"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-3">Corporate Commitments</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Over 3,000 companies have set science-based targets to reach net-zero. Major corporations like Apple, Google, and Microsoft are powering operations with 100% renewable energy. Supply chain commitments are driving change.
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
            <h3 className="font-semibold text-green-800 mb-3">The Momentum is Real:</h3>
            <p className="text-green-700 leading-relaxed">
              The clean energy transition is no longer theoretical — it's happening. The question is whether we can scale solutions fast enough to avoid the worst impacts of climate change.
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