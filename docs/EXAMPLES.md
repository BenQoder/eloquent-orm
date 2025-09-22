# Examples and Use Cases

This guide provides practical examples of using Eloquent ORM in real-world scenarios.

## Table of Contents

- [E-commerce System](#e-commerce-system)
- [Blog Platform](#blog-platform)
- [User Management](#user-management)
- [Content Management](#content-management)
- [Analytics & Reporting](#analytics--reporting)
- [Advanced Patterns](#advanced-patterns)

## E-commerce System

### Product Catalog with Categories and Reviews

```typescript
// Models
class Product extends Eloquent {
    protected static table = 'products';

    static schema = z.object({
        id: z.number().int().optional(),
        name: z.string(),
        description: z.string().nullable().optional(),
        price: z.string(), // Decimal as string for precision
        sku: z.string(),
        stock_quantity: z.number().int(),
        is_active: z.boolean(),
        category_id: z.number().int(),
        created_at: z.date().optional(),
        updated_at: z.date().optional(),
    });

    relationsTypes!: {
        category: Category;
        reviews: Review[];
        orders: Order[];
        images: ProductImage[];
        averageReview: Review;
    };

    category() {
        return this.belongsTo(Category, 'category_id');
    }

    reviews() {
        return this.hasMany(Review, 'product_id');
    }

    orders() {
        return this.belongsToMany(Order, 'order_items', 'product_id', 'order_id');
    }

    images() {
        return this.hasMany(ProductImage, 'product_id').orderBy('sort_order');
    }

    averageReview() {
        return this.hasOneOfMany(Review, 'product_id', 'rating', 'max');
    }
}

interface Product extends z.infer<typeof Product.schema> {}

class Category extends Eloquent {
    static schema = z.object({
        id: z.number().int().optional(),
        name: z.string(),
        slug: z.string(),
        parent_id: z.number().int().nullable().optional(),
    });

    relationsTypes!: {
        products: Product[];
        parent: Category;
        children: Category[];
    };

    products() {
        return this.hasMany(Product, 'category_id');
    }

    parent() {
        return this.belongsTo(Category, 'parent_id');
    }

    children() {
        return this.hasMany(Category, 'parent_id');
    }
}

interface Category extends z.infer<typeof Category.schema> {}

// Usage Examples

// 1. Product catalog with filtering and pagination
async function getProductCatalog(filters: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    search?: string;
    page?: number;
    limit?: number;
}) {
    let query = Product.query()
        .with(['category', 'images', 'averageReview'])
        .where('is_active', true);

    // Apply filters
    if (filters.category) {
        query = query.whereHas('category', q =>
            q.where('slug', filters.category)
        );
    }

    if (filters.minPrice) {
        query = query.where('price', '>=', filters.minPrice.toString());
    }

    if (filters.maxPrice) {
        query = query.where('price', '<=', filters.maxPrice.toString());
    }

    if (filters.inStock) {
        query = query.where('stock_quantity', '>', 0);
    }

    if (filters.search) {
        query = query.where(q =>
            q.where('name', 'like', `%${filters.search}%`)
             .orWhere('description', 'like', `%${filters.search}%`)
        );
    }

    // Pagination
    const limit = filters.limit || 20;
    const offset = ((filters.page || 1) - 1) * limit;

    const products = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

    return products.map(product => ({
        id: product.id,
        name: product.name,
        price: parseFloat(product.price),
        category: product.category.name,
        mainImage: product.images[0]?.url,
        averageRating: product.averageReview?.rating,
        inStock: product.stock_quantity > 0
    }));
}

// 2. Product details with reviews
async function getProductDetails(productId: number) {
    const product = await Product.query()
        .with([
            'category',
            'images',
            'reviews:id,rating,comment,user_id,created_at'
        ])
        .withAvg('reviews', 'rating')
        .withCount('reviews')
        .find(productId);

    if (!product) {
        throw new Error('Product not found');
    }

    return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: parseFloat(product.price),
        sku: product.sku,
        category: {
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug
        },
        images: product.images.map(img => ({
            url: img.url,
            alt: img.alt_text
        })),
        reviews: {
            average: product.reviews_avg_rating,
            count: product.reviews_count,
            items: product.reviews.slice(0, 5) // Latest 5 reviews
        },
        inStock: product.stock_quantity > 0,
        stockQuantity: product.stock_quantity
    };
}

// 3. Category tree with product counts
async function getCategoryTree() {
    const categories = await Category.query()
        .whereNull('parent_id')
        .with('children')
        .withCount('products')
        .orderBy('name')
        .get();

    return categories.map(category => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        productCount: category.products_count,
        children: category.children.map(child => ({
            id: child.id,
            name: child.name,
            slug: child.slug
        }))
    }));
}
```

### Order Management and Analytics

```typescript
class Order extends Eloquent {
    static schema = z.object({
        id: z.number().int().optional(),
        user_id: z.number().int(),
        status: z.enum(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
        total_amount: z.string(),
        shipping_address: z.string(),
        created_at: z.date().optional(),
        updated_at: z.date().optional(),
    });

    relationsTypes!: {
        user: User;
        items: OrderItem[];
        products: Product[];
    };

    user() {
        return this.belongsTo(User, 'user_id');
    }

    items() {
        return this.hasMany(OrderItem, 'order_id');
    }

    products() {
        return this.belongsToMany(Product, 'order_items', 'order_id', 'product_id');
    }
}

interface Order extends z.infer<typeof Order.schema> {}

// Sales analytics
async function getSalesAnalytics(startDate: string, endDate: string) {
    const orders = await Order.query()
        .with(['items', 'user'])
        .where('status', '!=', 'cancelled')
        .whereBetween('created_at', [startDate, endDate])
        .get();

    const analytics = {
        totalRevenue: 0,
        totalOrders: orders.length,
        averageOrderValue: 0,
        topProducts: new Map<number, { name: string; quantity: number; revenue: number }>(),
        dailySales: new Map<string, { orders: number; revenue: number }>()
    };

    for (const order of orders) {
        const orderTotal = parseFloat(order.total_amount);
        analytics.totalRevenue += orderTotal;

        // Daily sales
        const date = order.created_at.toISOString().split('T')[0];
        const dailySale = analytics.dailySales.get(date) || { orders: 0, revenue: 0 };
        dailySale.orders++;
        dailySale.revenue += orderTotal;
        analytics.dailySales.set(date, dailySale);

        // Top products
        for (const item of order.items) {
            const existing = analytics.topProducts.get(item.product_id) || {
                name: item.product_name,
                quantity: 0,
                revenue: 0
            };
            existing.quantity += item.quantity;
            existing.revenue += parseFloat(item.price) * item.quantity;
            analytics.topProducts.set(item.product_id, existing);
        }
    }

    analytics.averageOrderValue = analytics.totalRevenue / analytics.totalOrders;

    return analytics;
}
```

## Blog Platform

### Posts, Comments, and Tags

```typescript
class Post extends Eloquent {
    protected static table = 'posts';
    static softDeletes = true;

    static schema = z.object({
        id: z.number().int().optional(),
        title: z.string(),
        slug: z.string(),
        content: z.string(),
        excerpt: z.string().nullable().optional(),
        featured_image: z.string().nullable().optional(),
        status: z.enum(['draft', 'published', 'archived']),
        published_at: z.date().nullable().optional(),
        user_id: z.number().int(),
        category_id: z.number().int(),
        view_count: z.number().int().default(0),
        created_at: z.date().optional(),
        updated_at: z.date().optional(),
        deleted_at: z.date().nullable().optional(),
    });

    relationsTypes!: {
        author: User;
        category: Category;
        comments: Comment[];
        tags: Tag[];
        approvedComments: Comment[];
        latestComment: Comment;
    };

    author() {
        return this.belongsTo(User, 'user_id');
    }

    category() {
        return this.belongsTo(Category, 'category_id');
    }

    comments() {
        return this.hasMany(Comment, 'post_id');
    }

    approvedComments() {
        return this.hasMany(Comment, 'post_id').where('status', 'approved');
    }

    tags() {
        return this.belongsToMany(Tag, 'post_tags', 'post_id', 'tag_id');
    }

    latestComment() {
        return this.hasOneOfMany(Comment, 'post_id', 'created_at', 'max');
    }
}

interface Post extends z.infer<typeof Post.schema> {}

class Comment extends Eloquent {
    static schema = z.object({
        id: z.number().int().optional(),
        content: z.string(),
        status: z.enum(['pending', 'approved', 'rejected']),
        user_id: z.number().int().nullable().optional(),
        author_name: z.string().nullable().optional(),
        author_email: z.string().email().nullable().optional(),
        post_id: z.number().int(),
        parent_id: z.number().int().nullable().optional(),
        created_at: z.date().optional(),
    });

    relationsTypes!: {
        post: Post;
        user: User;
        author: User;
        parent: Comment;
        replies: Comment[];
    };

    post() {
        return this.belongsTo(Post, 'post_id');
    }

    user() {
        return this.belongsTo(User, 'user_id');
    }

    author() {
        return this.belongsTo(User, 'user_id');
    }

    parent() {
        return this.belongsTo(Comment, 'parent_id');
    }

    replies() {
        return this.hasMany(Comment, 'parent_id');
    }
}

interface Comment extends z.infer<typeof Comment.schema> {}

// Blog examples

// 1. Published posts with pagination
async function getBlogPosts(page = 1, limit = 10, categorySlug?: string) {
    let query = Post.query()
        .with(['author:id,name', 'category:id,name,slug', 'tags:id,name,slug'])
        .withCount(['approvedComments'])
        .where('status', 'published')
        .whereNotNull('published_at')
        .where('published_at', '<=', new Date());

    if (categorySlug) {
        query = query.whereHas('category', q => q.where('slug', categorySlug));
    }

    const posts = await query
        .orderBy('published_at', 'desc')
        .limit(limit)
        .offset((page - 1) * limit)
        .get();

    return posts.map(post => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        featuredImage: post.featured_image,
        publishedAt: post.published_at,
        author: {
            name: post.author.name
        },
        category: {
            name: post.category.name,
            slug: post.category.slug
        },
        tags: post.tags.map(tag => ({
            name: tag.name,
            slug: tag.slug
        })),
        commentCount: post.approved_comments_count,
        viewCount: post.view_count
    }));
}

// 2. Single post with comments
async function getPostWithComments(slug: string) {
    const post = await Post.query()
        .with([
            'author:id,name,avatar',
            'category:id,name,slug',
            'tags:id,name,slug',
            'approvedComments.author:id,name,avatar',
            'approvedComments.replies.author:id,name,avatar'
        ])
        .where('slug', slug)
        .where('status', 'published')
        .first();

    if (!post) {
        return null;
    }

    // Organize comments in a tree structure
    const topLevelComments = post.approvedComments
        .filter(comment => !comment.parent_id)
        .map(comment => ({
            id: comment.id,
            content: comment.content,
            createdAt: comment.created_at,
            author: {
                name: comment.author?.name || comment.author_name,
                avatar: comment.author?.avatar
            },
            replies: comment.replies.map(reply => ({
                id: reply.id,
                content: reply.content,
                createdAt: reply.created_at,
                author: {
                    name: reply.author?.name || reply.author_name,
                    avatar: reply.author?.avatar
                }
            }))
        }));

    return {
        id: post.id,
        title: post.title,
        content: post.content,
        featuredImage: post.featured_image,
        publishedAt: post.published_at,
        author: {
            name: post.author.name,
            avatar: post.author.avatar
        },
        category: {
            name: post.category.name,
            slug: post.category.slug
        },
        tags: post.tags.map(tag => ({
            name: tag.name,
            slug: tag.slug
        })),
        comments: topLevelComments,
        viewCount: post.view_count
    };
}

// 3. Popular posts by views and comments
async function getPopularPosts(limit = 5, days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const posts = await Post.query()
        .with(['author:id,name', 'category:id,name,slug'])
        .withCount('approvedComments')
        .where('status', 'published')
        .where('published_at', '>=', cutoffDate)
        .orderBy('view_count', 'desc')
        .limit(limit)
        .get();

    return posts.map(post => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        publishedAt: post.published_at,
        author: post.author.name,
        category: post.category.name,
        viewCount: post.view_count,
        commentCount: post.approved_comments_count
    }));
}
```

## User Management

### User Profiles with Roles and Permissions

```typescript
class User extends Eloquent {
    protected static table = 'users';
    protected static hidden = ['password', 'remember_token'];
    static softDeletes = true;

    static schema = z.object({
        id: z.number().int().optional(),
        name: z.string(),
        email: z.string().email(),
        email_verified_at: z.date().nullable().optional(),
        avatar: z.string().nullable().optional(),
        bio: z.string().nullable().optional(),
        location: z.string().nullable().optional(),
        website: z.string().url().nullable().optional(),
        is_active: z.boolean().default(true),
        last_login_at: z.date().nullable().optional(),
        created_at: z.date().optional(),
        updated_at: z.date().optional(),
        deleted_at: z.date().nullable().optional(),
    });

    relationsTypes!: {
        profile: UserProfile;
        posts: Post[];
        comments: Comment[];
        roles: Role[];
        permissions: Permission[];
        notifications: Notification[];
        followers: User[];
        following: User[];
        latestPost: Post;
    };

    profile() {
        return this.hasOne(UserProfile, 'user_id');
    }

    posts() {
        return this.hasMany(Post, 'user_id');
    }

    publishedPosts() {
        return this.hasMany(Post, 'user_id').where('status', 'published');
    }

    comments() {
        return this.hasMany(Comment, 'user_id');
    }

    roles() {
        return this.belongsToMany(Role, 'user_roles', 'user_id', 'role_id');
    }

    permissions() {
        return this.belongsToMany(Permission, 'user_permissions', 'user_id', 'permission_id');
    }

    followers() {
        return this.belongsToMany(User, 'user_follows', 'following_id', 'follower_id');
    }

    following() {
        return this.belongsToMany(User, 'user_follows', 'follower_id', 'following_id');
    }

    latestPost() {
        return this.hasOneOfMany(Post, 'user_id', 'created_at', 'max');
    }
}

interface User extends z.infer<typeof User.schema> {}

// User management examples

// 1. User dashboard with statistics
async function getUserDashboard(userId: number) {
    const user = await User.query()
        .with(['profile', 'latestPost:id,title,created_at'])
        .withCount(['posts', 'comments', 'followers', 'following'])
        .find(userId);

    if (!user) {
        return null;
    }

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        location: user.location,
        website: user.website,
        joinedAt: user.created_at,
        lastLoginAt: user.last_login_at,
        stats: {
            postsCount: user.posts_count,
            commentsCount: user.comments_count,
            followersCount: user.followers_count,
            followingCount: user.following_count
        },
        latestPost: user.latestPost ? {
            id: user.latestPost.id,
            title: user.latestPost.title,
            createdAt: user.latestPost.created_at
        } : null
    };
}

// 2. User search with filters
async function searchUsers(filters: {
    query?: string;
    role?: string;
    isActive?: boolean;
    hasAvatar?: boolean;
    joinedAfter?: Date;
    page?: number;
    limit?: number;
}) {
    let query = User.query()
        .with(['roles:id,name'])
        .withCount(['posts', 'followers']);

    if (filters.query) {
        query = query.where(q =>
            q.where('name', 'like', `%${filters.query}%`)
             .orWhere('email', 'like', `%${filters.query}%`)
        );
    }

    if (filters.role) {
        query = query.whereHas('roles', q => q.where('name', filters.role));
    }

    if (filters.isActive !== undefined) {
        query = query.where('is_active', filters.isActive);
    }

    if (filters.hasAvatar) {
        query = query.whereNotNull('avatar');
    }

    if (filters.joinedAfter) {
        query = query.where('created_at', '>=', filters.joinedAfter);
    }

    const limit = filters.limit || 20;
    const offset = ((filters.page || 1) - 1) * limit;

    const users = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

    return users.map(user => ({
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        isActive: user.is_active,
        joinedAt: user.created_at,
        roles: user.roles.map(role => role.name),
        stats: {
            posts: user.posts_count,
            followers: user.followers_count
        }
    }));
}

// 3. Active users with recent activity
async function getActiveUsers(days = 7, limit = 10) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const users = await User.query()
        .with(['latestPost:id,title,created_at'])
        .withCount('posts')
        .where('is_active', true)
        .where('last_login_at', '>=', cutoffDate)
        .orderBy('last_login_at', 'desc')
        .limit(limit)
        .get();

    return users.map(user => ({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        lastLoginAt: user.last_login_at,
        postsCount: user.posts_count,
        latestPost: user.latestPost
    }));
}
```

## Content Management

### CMS with Polymorphic Relations

```typescript
// Media can be attached to posts, pages, products, etc.
class Media extends Eloquent {
    static schema = z.object({
        id: z.number().int().optional(),
        filename: z.string(),
        original_name: z.string(),
        mime_type: z.string(),
        size: z.number().int(),
        url: z.string(),
        alt_text: z.string().nullable().optional(),
        mediable_type: z.string(),
        mediable_id: z.number().int(),
        created_at: z.date().optional(),
    });

    relationsTypes!: {
        mediable: Post | Page | Product; // Polymorphic relation
    };

    mediable() {
        return this.morphTo('mediable', 'mediable_type', 'mediable_id');
    }
}

interface Media extends z.infer<typeof Media.schema> {}

class Page extends Eloquent {
    static schema = z.object({
        id: z.number().int().optional(),
        title: z.string(),
        slug: z.string(),
        content: z.string(),
        template: z.string().nullable().optional(),
        is_published: z.boolean(),
        meta_title: z.string().nullable().optional(),
        meta_description: z.string().nullable().optional(),
        created_at: z.date().optional(),
        updated_at: z.date().optional(),
    });

    relationsTypes!: {
        media: Media[];
        featuredImage: Media;
    };

    media() {
        return this.morphMany(Media, 'mediable', 'mediable_type', 'mediable_id');
    }

    featuredImage() {
        return this.morphOne(Media, 'mediable', 'mediable_type', 'mediable_id')
            .where('alt_text', 'featured');
    }
}

interface Page extends z.infer<typeof Page.schema> {}

// CMS examples

// 1. Get page with all media
async function getPageContent(slug: string) {
    const page = await Page.query()
        .with(['media', 'featuredImage'])
        .where('slug', slug)
        .where('is_published', true)
        .first();

    if (!page) {
        return null;
    }

    return {
        id: page.id,
        title: page.title,
        content: page.content,
        template: page.template,
        meta: {
            title: page.meta_title,
            description: page.meta_description
        },
        featuredImage: page.featuredImage ? {
            url: page.featuredImage.url,
            alt: page.featuredImage.alt_text
        } : null,
        gallery: page.media
            .filter(m => m.alt_text !== 'featured')
            .map(m => ({
                url: m.url,
                alt: m.alt_text,
                type: m.mime_type
            }))
    };
}

// 2. Media library with usage tracking
async function getMediaLibrary(filters: {
    type?: 'image' | 'video' | 'document';
    unused?: boolean;
    page?: number;
    limit?: number;
}) {
    let query = Media.query()
        .select('*')
        .addSelect(Media.raw('COUNT(mediable_id) as usage_count'))
        .groupBy('id');

    if (filters.type === 'image') {
        query = query.where('mime_type', 'like', 'image/%');
    } else if (filters.type === 'video') {
        query = query.where('mime_type', 'like', 'video/%');
    } else if (filters.type === 'document') {
        query = query.where('mime_type', 'not like', 'image/%')
                     .where('mime_type', 'not like', 'video/%');
    }

    if (filters.unused) {
        query = query.having('usage_count', '=', 0);
    }

    const limit = filters.limit || 20;
    const offset = ((filters.page || 1) - 1) * limit;

    const media = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

    return media.map(item => ({
        id: item.id,
        filename: item.filename,
        originalName: item.original_name,
        url: item.url,
        size: item.size,
        mimeType: item.mime_type,
        usageCount: item.usage_count,
        createdAt: item.created_at
    }));
}
```

## Analytics & Reporting

### Advanced Analytics Queries

```typescript
// Analytics examples

// 1. Content performance analytics
async function getContentAnalytics(startDate: string, endDate: string) {
    // Most viewed posts
    const popularPosts = await Post.query()
        .with(['author:id,name', 'category:id,name'])
        .withCount('comments')
        .where('status', 'published')
        .whereBetween('created_at', [startDate, endDate])
        .orderBy('view_count', 'desc')
        .limit(10)
        .get();

    // Author performance
    const authorStats = await User.query()
        .withCount(['posts', 'comments'])
        .withSum('posts', 'view_count')
        .withAvg('posts', 'view_count')
        .whereHas('posts', q =>
            q.where('status', 'published')
             .whereBetween('created_at', [startDate, endDate])
        )
        .orderBy('posts_sum_view_count', 'desc')
        .limit(10)
        .get();

    // Category performance
    const categoryStats = await Category.query()
        .withCount('posts')
        .withSum('posts', 'view_count')
        .whereHas('posts', q =>
            q.where('status', 'published')
             .whereBetween('created_at', [startDate, endDate])
        )
        .orderBy('posts_sum_view_count', 'desc')
        .get();

    return {
        popularPosts: popularPosts.map(post => ({
            title: post.title,
            author: post.author.name,
            category: post.category.name,
            views: post.view_count,
            comments: post.comments_count
        })),
        topAuthors: authorStats.map(author => ({
            name: author.name,
            postsCount: author.posts_count,
            totalViews: author.posts_sum_view_count,
            averageViews: author.posts_avg_view_count
        })),
        categoryPerformance: categoryStats.map(category => ({
            name: category.name,
            postsCount: category.posts_count,
            totalViews: category.posts_sum_view_count
        }))
    };
}

// 2. User engagement analytics
async function getUserEngagementAnalytics(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Active users
    const activeUsers = await User.query()
        .withCount(['posts', 'comments'])
        .where('last_login_at', '>=', cutoffDate)
        .orderBy('last_login_at', 'desc')
        .get();

    // New user registrations
    const newUsers = await User.query()
        .where('created_at', '>=', cutoffDate)
        .orderBy('created_at', 'desc')
        .get();

    // User retention (users who logged in after their first week)
    const retainedUsers = await User.query()
        .whereRaw('last_login_at > DATE_ADD(created_at, INTERVAL 7 DAY)')
        .where('created_at', '>=', cutoffDate)
        .count();

    const totalNewUsers = newUsers.length;
    const retentionRate = totalNewUsers > 0 ? (retainedUsers / totalNewUsers) * 100 : 0;

    return {
        activeUsersCount: activeUsers.length,
        newUsersCount: totalNewUsers,
        retentionRate: retentionRate,
        engagementByDay: groupUsersByDay(activeUsers),
        topContributors: activeUsers
            .filter(user => user.posts_count > 0 || user.comments_count > 0)
            .slice(0, 10)
            .map(user => ({
                name: user.name,
                posts: user.posts_count,
                comments: user.comments_count,
                lastActive: user.last_login_at
            }))
    };
}

function groupUsersByDay(users: User[]) {
    const dailyStats = new Map<string, number>();

    users.forEach(user => {
        if (user.last_login_at) {
            const date = user.last_login_at.toISOString().split('T')[0];
            dailyStats.set(date, (dailyStats.get(date) || 0) + 1);
        }
    });

    return Array.from(dailyStats.entries()).map(([date, count]) => ({
        date,
        activeUsers: count
    }));
}
```

## Advanced Patterns

### Complex Queries and Optimizations

```typescript
// 1. Batch processing with chunking
async function processLargeDataset() {
    let processedCount = 0;

    await User.query()
        .where('is_active', true)
        .chunkAsync(1000, async (users) => {
            // Process users in batches to avoid memory issues
            const userIds = users.map(u => u.id);

            // Load related data efficiently
            await User.load(users, {
                posts: query => query.where('status', 'published').limit(5)
            });

            // Process each user
            for (const user of users) {
                await processUserData(user);
                processedCount++;
            }

            console.log(`Processed ${processedCount} users so far...`);
        });

    console.log(`Completed processing ${processedCount} users`);
}

// 2. Complex search with multiple criteria
async function advancedSearch(criteria: {
    query?: string;
    categories?: string[];
    tags?: string[];
    dateRange?: { start: string; end: string };
    authorId?: number;
    minViews?: number;
    hasComments?: boolean;
    sortBy?: 'relevance' | 'date' | 'views' | 'comments';
    page?: number;
    limit?: number;
}) {
    let query = Post.query()
        .with(['author:id,name', 'category:id,name,slug', 'tags:id,name,slug'])
        .withCount(['comments'])
        .where('status', 'published');

    // Text search
    if (criteria.query) {
        query = query.where(q =>
            q.where('title', 'like', `%${criteria.query}%`)
             .orWhere('content', 'like', `%${criteria.query}%`)
             .orWhere('excerpt', 'like', `%${criteria.query}%`)
        );
    }

    // Category filter
    if (criteria.categories?.length) {
        query = query.whereHas('category', q =>
            q.whereIn('slug', criteria.categories!)
        );
    }

    // Tags filter
    if (criteria.tags?.length) {
        query = query.whereHas('tags', q =>
            q.whereIn('slug', criteria.tags!)
        );
    }

    // Date range
    if (criteria.dateRange) {
        query = query.whereBetween('published_at', [
            criteria.dateRange.start,
            criteria.dateRange.end
        ]);
    }

    // Author filter
    if (criteria.authorId) {
        query = query.where('user_id', criteria.authorId);
    }

    // Minimum views
    if (criteria.minViews) {
        query = query.where('view_count', '>=', criteria.minViews);
    }

    // Has comments
    if (criteria.hasComments) {
        query = query.has('comments');
    }

    // Sorting
    switch (criteria.sortBy) {
        case 'date':
            query = query.orderBy('published_at', 'desc');
            break;
        case 'views':
            query = query.orderBy('view_count', 'desc');
            break;
        case 'comments':
            query = query.orderBy('comments_count', 'desc');
            break;
        case 'relevance':
        default:
            // For relevance, we might order by a combination of factors
            query = query.orderBy(Post.raw('(view_count * 0.3) + (comments_count * 0.7)'), 'desc');
            break;
    }

    // Pagination
    const limit = criteria.limit || 20;
    const offset = ((criteria.page || 1) - 1) * limit;

    const posts = await query
        .limit(limit)
        .offset(offset)
        .get();

    return posts.map(post => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        publishedAt: post.published_at,
        viewCount: post.view_count,
        author: {
            id: post.author.id,
            name: post.author.name
        },
        category: {
            name: post.category.name,
            slug: post.category.slug
        },
        tags: post.tags.map(tag => ({
            name: tag.name,
            slug: tag.slug
        })),
        commentCount: post.comments_count
    }));
}

// 3. Caching strategy for expensive queries
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedPopularContent() {
    const cacheKey = 'popular_content';
    const cached = queryCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    const data = await Post.query()
        .with(['author:id,name', 'category:id,name'])
        .withCount(['comments'])
        .where('status', 'published')
        .where('view_count', '>', 1000)
        .orderBy('view_count', 'desc')
        .limit(10)
        .get();

    queryCache.set(cacheKey, {
        data: data.map(post => ({
            id: post.id,
            title: post.title,
            author: post.author.name,
            category: post.category.name,
            views: post.view_count,
            comments: post.comments_count
        })),
        timestamp: Date.now()
    });

    return queryCache.get(cacheKey)!.data;
}
```

These examples demonstrate real-world usage patterns and best practices for using Eloquent ORM in complex applications. Each example focuses on type safety, performance optimization, and maintainable code structure.