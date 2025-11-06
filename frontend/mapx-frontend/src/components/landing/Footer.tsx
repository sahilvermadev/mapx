export function Footer() {
  return (
    <footer className="border-t-4 border-black bg-white">
      <div className="container mx-auto px-6 py-16">
        {/* Main Footer Content */}
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div>
            <div className="text-xl font-bold mb-4 text-black">Recce</div>
            <p className="text-gray-600 text-sm leading-relaxed">
              AI-powered local discovery through your trusted network. 
              Finally, recommendations you can trust.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-medium mb-4 text-gray-900">Product</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a></li>
              <li><a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">How it Works</a></li>
              <li><a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">AI Search</a></li>
              <li><a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">Privacy</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-medium mb-4 text-gray-900">Company</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">About</a></li>
              <li><a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">Careers</a></li>
              <li><a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">Press</a></li>
              <li><a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">Blog</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-medium mb-4 text-gray-900">Support</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">Help Center</a></li>
              <li><a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">Contact</a></li>
              <li><a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">Community</a></li>
              <li><a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">Status</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-200 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-gray-600 text-sm">
              © 2024 Recce. All rights reserved.
            </div>
            
            <div className="flex gap-6 text-sm">
              <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">Privacy</a>
              <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">Terms</a>
              <a href="#" className="text-gray-600 hover:text-gray-900 transition-colors">Cookies</a>
            </div>

            <div className="text-gray-600 text-sm">
              hello@recce.app
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

