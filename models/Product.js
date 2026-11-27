import mongoose from 'mongoose';

const VariantSchema = new mongoose.Schema(
  {
    color: { type: String, default: '' },
    colorHex: { type: String, default: '#000000' },
    images: [{ type: String }],
    price: { type: Number, required: true },
    compareAtPrice: { type: Number, default: 0 },

    sizes: [
      {
        size: { type: String, required: true },
        stock: { type: Number, default: 0 },
        sku: { type: String }
      }
    ]
  },
  { _id: true }
);

// A single named add-on option (e.g. "Cotton Palazzo", "Bandhani Shawl").
// `price` is an ADDITIONAL amount added on top of the variant price when
// this option is picked — not a standalone price.
const AddonOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    price: { type: Number, default: 0 },
    stock: { type: Number, default: 0 },
    sku: { type: String, default: '' }
  },
  { _id: true }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
    description: { type: String, default: '' },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    fabric: { type: String, default: '' },

    // Shipping weight of ONE piece, in grams. Used to compute order weight
    // for shipping. 0 = not set → falls back to Settings.weightPerPiece.
    weight: { type: Number, default: 0, min: 0 },

    tags: [{ type: String }],
    variants: [VariantSchema],

    // One or more optional size chart images. If empty, the storefront
    // falls back to this product's category.sizeChart instead.
    sizeChart: [{ type: String }],

    // One or more optional product videos.
    videos: [{ type: String }],

    sleeveOptions: [{ type: String, enum: ['Full Sleeve', 'Half Sleeve', 'Elbow Sleeve', 'Sleeveless'] }],
    zipOptions: [{ type: String, enum: ['With Zip', 'Without Zip'] }],

    pantOptions: [AddonOptionSchema],
    shawlOptions: [AddonOptionSchema],

    isReadyToShip: { type: Boolean, default: false },

    // Per-product shipping override.
    //   mode: 'default' -> use global/state weight-based rates (Settings)
    //         'free'    -> this product adds no shipping
    //         'fixed'   -> `fee` ₹ per piece
    // stateRules override the above for customers in that state.
    shipping: {
      mode: { type: String, enum: ['default', 'free', 'fixed'], default: 'default' },
      fee: { type: Number, default: 0, min: 0 },
      stateRules: [
        {
          _id: false,
          state: { type: String, required: true },
          mode: { type: String, enum: ['default', 'free', 'fixed'], default: 'fixed' },
          fee: { type: Number, default: 0, min: 0 }
        }
      ]
    },

    basePrice: { type: Number, required: true }, // used for listing/sorting
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    isBestSeller: { type: Boolean, default: false },
    isTopSeller: { type: Boolean, default: false },
    isActiveSeller: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    soldCount: { type: Number, default: 0 },
    seoTitle: String,
    seoDescription: String
  },
  { timestamps: true }
);

ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);