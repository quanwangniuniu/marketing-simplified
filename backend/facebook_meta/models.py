from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField

User = get_user_model()

# 1. AdCreativePhotoData
class AdCreativePhotoData(models.Model):
    branded_content_shared_to_sponsor_status = models.CharField(max_length=64, blank=True, default="", help_text="The branded content shared to sponsor option")
    branded_content_sponsor_page_id = models.CharField(max_length=64, blank=True, default="", help_text="ID of a Facebook page.")
    branded_content_sponser_relationship = models.CharField(max_length=64, blank=True, default="", help_text="The branded content sponsor relationship option")
    caption = models.TextField(blank=True, default="", help_text="The description of the image")
    image_hash = models.CharField(max_length=255, blank=True, default="", help_text="Hash of an image in your image library with Facebook.")
    page_welcome_message = models.CharField(max_length=512, blank=True, default="", help_text="A welcome text from page to user on Messenger once a user performs send message action on an ad")
    url = models.CharField(max_length=512, blank=True, default="", help_text="URL of an image to use in the ad.")

    def __str__(self) -> str:
        return f"PhotoData - {self.caption[:50]}"

# 2. AdCreativeTextData
class AdCreativeTextData(models.Model):
    message = models.TextField(help_text="The text of the page post.")

    def __str__(self) -> str:
        return f"TextData - {self.message[:50]}"
        
# 3. AdCreativeVideoData
class AdCreativeVideoData(models.Model):
    additional_image_index = models.IntegerField(blank=True, null=True, help_text="The index (zero based) of the image from the additional images array to use as the ad image for a dynamic product ad")
    branded_content_shared_to_sponsor_status = models.CharField(max_length=64, blank=True, default="", help_text="The branded content shared to sponsor option")
    branded_content_sponsor_page_id = models.CharField(max_length=64, blank=True, default="", help_text="The branded content sponsor page id.")
    branded_content_sponser_relationship = models.CharField(max_length=64, blank=True, default="", help_text="The branded content sponsor relationship option")
    call_to_action = models.JSONField(blank=True, null=True, help_text="An optional call to action.")
    caption_ids = ArrayField(models.JSONField(blank=True, null=True), help_text="The caption ids of the videos.", blank=True, null=True)
    collection_thumbnails = ArrayField(models.JSONField(blank=True, null=True), help_text="The collection thumbnails for a dynamic product ad", blank=True, null=True)
    customization_rules_spec = ArrayField(models.JSONField(blank=True, null=True), help_text="Customization rules for a dynamic ad", blank=True, null=True)
    image_hash = models.CharField(max_length=255, blank=True, default="", help_text="Hash of an image in your image library with Facebook to use as thumbnail")
    image_url = models.CharField(max_length=512, blank=True, default="", help_text="URL of image to use as thumbnail.")
    link_description = models.TextField(blank=True, default="", help_text="Link description of the video.")
    message = models.TextField(blank=True, default="", help_text="The main body of the video post.")
    offer_id = models.CharField(max_length=64, blank=True, default="", help_text="The id of a Facebook native offer")
    page_welcome_message = models.CharField(max_length=512, blank=True, default="", help_text="A welcome text from page to user on Messenger once a user performs send message action on an ad")
    post_click_configuration = models.JSONField(blank=True, null=True, help_text="Customized contents provided by the advertiser for the ad post-click experience")
    retailer_item_ids = ArrayField(models.JSONField(blank=True, null=True), help_text="List of product IDs provided by the advertiser for Collections", blank=True, null=True)
    targeting = models.JSONField(blank=True, null=True, help_text="The post gating for the video.")
    title = models.CharField(max_length=255, blank=True, default="", help_text="The title of the video.")
    video_id = models.CharField(max_length=64, blank=True, default="", help_text="ID of video that user has permission to or a video in ad account video library.")

    def __str__(self) -> str:
        return f"VideoData - {self.title}"


# 4. AdCreativeLinkData
class AdCreativeLinkData(models.Model):
    # Attachment style choices
    ATTACHMENT_STYLE_LINK = "LINK"
    ATTACHMENT_STYLE_DEFAULT = "DEFAULT"
    ATTACHMENT_STYLE_CHOICES = [
        (ATTACHMENT_STYLE_LINK, "Link"),
        (ATTACHMENT_STYLE_DEFAULT, "Default"),
    ]

    # Format option choices
    FORMAT_OPTION_CAROUSEL_AR_EFFECTS = "carousel_ar_effects"
    FORMAT_OPTION_CAROUSEL_IMAGES_MULTI_ITEMS = "carousel_images_multi_items"
    FORMAT_OPTION_CAROUSEL_IMAGES_SINGLE_ITEM = "carousel_images_single_item"
    FORMAT_OPTION_CAROUSEL_SLIDESHOWS = "carousel_slideshows"
    FORMAT_OPTION_COLLECTION_VIDEO = "collection_video"
    FORMAT_OPTION_SINGLE_IMAGE = "single_image"
    FORMAT_OPTION_CHOICES = [
        (FORMAT_OPTION_CAROUSEL_AR_EFFECTS, "Carousel AR Effects"),
        (FORMAT_OPTION_CAROUSEL_IMAGES_MULTI_ITEMS, "Carousel Images Multi Items"),
        (FORMAT_OPTION_CAROUSEL_IMAGES_SINGLE_ITEM, "Carousel Images Single Item"),
        (FORMAT_OPTION_CAROUSEL_SLIDESHOWS, "Carousel Slideshows"),
        (FORMAT_OPTION_COLLECTION_VIDEO, "Collection Video"),
        (FORMAT_OPTION_SINGLE_IMAGE, "Single Image"),
    ]

    ad_context = models.CharField(max_length=255, blank=True, default="", help_text="String that represents the ad context provided by advertiser")
    additional_image_index = models.IntegerField(blank=True, null=True, help_text="The index (zero based) of the image from the additional images array to use as the ad image for a dynamic product ad")
    app_link_spec = models.JSONField(blank=True, null=True, help_text="Native deeplinks attached to the post")
    attachment_style = models.CharField(max_length=16, choices=ATTACHMENT_STYLE_CHOICES, blank=True, default="", help_text="The style of the attachment")
    boosted_product_set_id = models.CharField(max_length=64, blank=True, default="", help_text="Combined with product_set_id to promote a specific Product Set while including other products from the Product Catalog in ads")
    branded_content_shared_to_sponsor_status = models.CharField(max_length=64, blank=True, default="", help_text="The branded content shared to sponsor option")
    branded_content_sponsor_page_id = models.CharField(max_length=64, blank=True, default="", help_text="The branded content sponsor page id")
    branded_content_sponsor_relationship = models.CharField(max_length=64, blank=True, default="", help_text="The branded content sponsor relationship option")
    call_to_action = models.JSONField(blank=True, null=True, help_text="An optional call to action button")
    caption = models.TextField(blank=True, default="", help_text="Link caption. Overwrites the caption under the title in the link")
    child_attachments = ArrayField(models.JSONField(blank=True, null=True), help_text="A 2-5 element array of link objects required for carousel ads", blank=True, null=True)
    collection_thumbnails = ArrayField(models.JSONField(blank=True, null=True), help_text="List of Canvas media component IDs and their square cropping information provided by the advertiser for Collection style feed rendering", blank=True, null=True)
    customization_rules_spec = ArrayField(models.JSONField(blank=True, null=True), help_text="Customization rules for a dynamic ad", blank=True, null=True)
    description = models.TextField(blank=True, default="", help_text="Link description. Overwrites the description in the link when your ad displays")
    event_id = models.CharField(max_length=64, blank=True, default="", help_text="The id of a Facebook event")
    force_single_link = models.BooleanField(default=False, help_text="Whether to force the post to render in a single link format")
    format_option = models.CharField(max_length=32, choices=FORMAT_OPTION_CHOICES, blank=True, default="", help_text="Options on how to render your ad")
    image_crops = models.JSONField(blank=True, null=True, help_text="How to the image should be cropped")
    image_hash = models.CharField(max_length=255, blank=True, default="", help_text="Hash of an image in your ad account's image library")
    image_layer_specs = ArrayField(models.JSONField(blank=True, null=True), help_text="How to render image overlays on a dynamic item in Dynamic Ads", blank=True, null=True)
    image_overlay_spec = models.JSONField(blank=True, null=True, help_text="How to render image overlays on a dynamic item in Dynamic Ads")
    link = models.CharField(max_length=512, blank=True, default="", help_text="Link url. This url is required to be the same as the CTA link url")
    message = models.TextField(blank=True, default="", help_text="The main body of the post")
    multi_share_end_card = models.BooleanField(default=True, help_text="If set to false, removes the end card which displays the page icon")
    multi_share_optimized = models.BooleanField(default=True, help_text="If set to true, automatically select and order images and links")
    name = models.CharField(max_length=255, blank=True, default="", help_text="Name of the link. Overwrite the title of the link when you preview the ad")
    offer_id = models.CharField(max_length=64, blank=True, default="", help_text="The id of a Facebook native offer")
    page_welcome_message = models.CharField(max_length=512, blank=True, default="", help_text="The customized greeting message that is presented to the user when they are redirected from a click to Messenger or click to Whatsapp ad to the messaging app")
    picture = models.CharField(max_length=512, blank=True, default="", help_text="URL of a picture to use in the post")
    post_click_configuration = models.JSONField(blank=True, null=True, help_text="Customized contents provided by the advertiser for the ad post-click experience")
    preferred_image_tags = ArrayField(models.JSONField(blank=True, null=True), help_text="Select which image to display by its tag, if you have added tags to your images", blank=True, null=True)
    preferred_video_tags = ArrayField(models.JSONField(blank=True, null=True), help_text="Selects which video to use, if you have added tags to your video", blank=True, null=True)
    retailer_item_ids = ArrayField(models.JSONField(blank=True, null=True), help_text="List of product IDs provided by the advertiser for Collections", blank=True, null=True)
    show_multiple_images = models.BooleanField(default=False, help_text="Use with force_single_link = true in order to show a single dynamic item but in carousel format using multiple images from the catalog")
    sponsorship_info = models.JSONField(blank=True, null=True, help_text="Give a fallback creative for dynamic ads")
    use_flexible_image_aspect_ratio = models.BooleanField(default=True, help_text="Default value is true. This field only applies if you do not provide a cropping spec")

    def __str__(self) -> str:
        return f"LinkData - {self.name}"

# 6. AdLabel
class AdLabel(models.Model):
    id = models.CharField(primary_key=True, max_length=64, unique=True, help_text="ID of the ad label.")
    created_time = models.DateTimeField(auto_now_add=True, help_text="Date and time the ad label was created.")
    updated_time = models.DateTimeField(auto_now=True, help_text="Date and time the ad label was updated.")
    name = models.CharField(max_length=255, help_text="Name of the ad label.")

    def __str__(self) -> str:
        return f"{self.id}"

# 7. AdCreative
class AdCreative(models.Model):
    # Call to action type choices
    CALL_TO_ACTION_CHOICES = [
        ("OPEN_LINK", "Open Link"), ("LIKE_PAGE", "Like Page"), ("SHOP_NOW", "Shop Now"),
        ("PLAY_GAME", "Play Game"), ("INSTALL_APP", "Install App"), ("USE_APP", "Use App"),
        ("CALL", "Call"), ("CALL_ME", "Call Me"), ("VIDEO_CALL", "Video Call"),
        ("INSTALL_MOBILE_APP", "Install Mobile App"), ("USE_MOBILE_APP", "Use Mobile App"),
        ("MOBILE_DOWNLOAD", "Mobile Download"), ("BOOK_TRAVEL", "Book Travel"),
        ("LISTEN_MUSIC", "Listen Music"), ("WATCH_VIDEO", "Watch Video"), ("LEARN_MORE", "Learn More"),
        ("SIGN_UP", "Sign Up"), ("DOWNLOAD", "Download"), ("WATCH_MORE", "Watch More"),
        ("NO_BUTTON", "No Button"), ("VISIT_PAGES_FEED", "Visit Pages Feed"), ("CALL_NOW", "Call Now"),
        ("APPLY_NOW", "Apply Now"), ("CONTACT", "Contact"), ("BUY_NOW", "Buy Now"),
        ("GET_OFFER", "Get Offer"), ("GET_OFFER_VIEW", "Get Offer View"), ("BUY_TICKETS", "Buy Tickets"),
        ("UPDATE_APP", "Update App"), ("GET_DIRECTIONS", "Get Directions"), ("BUY", "Buy"),
        ("SEND_UPDATES", "Send Updates"), ("MESSAGE_PAGE", "Message Page"), ("DONATE", "Donate"),
        ("SUBSCRIBE", "Subscribe"), ("SAY_THANKS", "Say Thanks"), ("SELL_NOW", "Sell Now"),
        ("SHARE", "Share"), ("DONATE_NOW", "Donate Now"), ("GET_QUOTE", "Get Quote"),
        ("CONTACT_US", "Contact Us"), ("ORDER_NOW", "Order Now"), ("START_ORDER", "Start Order"),
        ("ADD_TO_CART", "Add To Cart"), ("VIEW_CART", "View Cart"), ("VIEW_IN_CART", "View In Cart"),
        ("VIDEO_ANNOTATION", "Video Annotation"), ("RECORD_NOW", "Record Now"), ("INQUIRE_NOW", "Inquire Now"),
        ("CONFIRM", "Confirm"), ("REFER_FRIENDS", "Refer Friends"), ("REQUEST_TIME", "Request Time"),
        ("GET_SHOWTIMES", "Get Showtimes"), ("LISTEN_NOW", "Listen Now"), ("TRY_DEMO", "Try Demo"),
        ("WOODHENGE_SUPPORT", "Woodhenge Support"), ("SOTTO_SUBSCRIBE", "Sotto Subscribe"),
        ("FOLLOW_USER", "Follow User"), ("RAISE_MONEY", "Raise Money"), ("SEE_SHOP", "See Shop"),
        ("GET_DETAILS", "Get Details"), ("FIND_OUT_MORE", "Find Out More"), ("VISIT_WEBSITE", "Visit Website"),
        ("BROWSE_SHOP", "Browse Shop"), ("EVENT_RSVP", "Event Rsvp"), ("WHATSAPP_MESSAGE", "Whatsapp Message"),
        ("FOLLOW_NEWS_STORYLINE", "Follow News Storyline"), ("SEE_MORE", "See More"), ("BOOK_NOW", "Book Now"),
        ("FIND_A_GROUP", "Find A Group"), ("FIND_YOUR_GROUPS", "Find Your Groups"), ("PAY_TO_ACCESS", "Pay To Access"),
        ("PURCHASE_GIFT_CARDS", "Purchase Gift Cards"), ("FOLLOW_PAGE", "Follow Page"), ("SEND_A_GIFT", "Send A Gift"),
        ("SWIPE_UP_SHOP", "Swipe Up Shop"), ("SWIPE_UP_PRODUCT", "Swipe Up Product"), ("SEND_GIFT_MONEY", "Send Gift Money"),
        ("PLAY_GAME_ON_FACEBOOK", "Play Game On Facebook"), ("GET_STARTED", "Get Started"), ("OPEN_INSTANT_APP", "Open Instant App"),
        ("AUDIO_CALL", "Audio Call"), ("GET_PROMOTIONS", "Get Promotions"), ("JOIN_CHANNEL", "Join Channel"),
        ("MAKE_AN_APPOINTMENT", "Make An Appointment"), ("ASK_ABOUT_SERVICES", "Ask About Services"),
        ("BOOK_A_CONSULTATION", "Book A Consultation"), ("GET_A_QUOTE", "Get A Quote"), ("BUY_VIA_MESSAGE", "Buy Via Message"),
        ("ASK_FOR_MORE_INFO", "Ask For More Info"), ("CHAT_WITH_US", "Chat With Us"), ("VIEW_PRODUCT", "View Product"),
        ("VIEW_CHANNEL", "View Channel"), ("GET_IN_TOUCH", "Get In Touch"), ("WATCH_LIVE_VIDEO", "Watch Live Video"),
        ("SHOP_WITH_AI", "Shop With Ai"), ("TRY_ON_WITH_AI", "Try On With Ai"),
    ]
    # Status choices
    STATUS_ACTIVE = "ACTIVE"
    STATUS_IN_PROCESS = "IN_PROCESS"
    STATUS_WITH_ISSUES = "WITH_ISSUES"
    STATUS_DELETED = "DELETED"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_IN_PROCESS, "In Process"),
        (STATUS_WITH_ISSUES, "With Issues"),
        (STATUS_DELETED, "Deleted"),
    ]

    # Applink treatment choices
    APPLINK_DEFAULT = "DEFAULT"
    APPLINK_NONE = "NONE"
    APPLINK_CHOICES = [
        (APPLINK_DEFAULT, "Default"),
        (APPLINK_NONE, "None"),
    ]

    # Authorization category choices
    AUTH_NONE = "NONE"
    AUTH_DEFAULT = "DEFAULT"
    AUTH_CHOICES = [
        (AUTH_NONE, "None"),
        (AUTH_DEFAULT, "Default"),
    ]

    # Categorization criteria choices
    CATEGORIZATION_BRAND = "brand"
    CATEGORIZATION_CHOICES = [
        (CATEGORIZATION_BRAND, "Brand"),
    ]

    # Category media source choices
    CATEGORY_MEDIA_NONE = "NONE"
    CATEGORY_MEDIA_DEFAULT = "DEFAULT"
    CATEGORY_MEDIA_CHOICES = [
        (CATEGORY_MEDIA_NONE, "None"),
        (CATEGORY_MEDIA_DEFAULT, "Default"),
    ]

    # Object type choices
    OBJECT_TYPE_APPLICATION = "APPLICATION"
    OBJECT_TYPE_DOMAIN = "DOMAIN"
    OBJECT_TYPE_EVENT = "EVENT"
    OBJECT_TYPE_OFFER = "OFFER"
    OBJECT_TYPE_PAGE = "PAGE"
    OBJECT_TYPE_PHOTO = "PHOTO"
    OBJECT_TYPE_SHARE = "SHARE"
    OBJECT_TYPE_STATUS = "STATUS"
    OBJECT_TYPE_STORE_ITEM = "STORE_ITEM"
    OBJECT_TYPE_VIDEO = "VIDEO"
    OBJECT_TYPE_INVALID = "INVALID"
    OBJECT_TYPE_PRIVACY_CHECK_FAIL = "PRIVACY_CHECK_FAIL"
    OBJECT_TYPE_POST_DELETED = "POST_DELETED"
    OBJECT_TYPE_CHOICES = [
        (OBJECT_TYPE_APPLICATION, "Application"),
        (OBJECT_TYPE_DOMAIN, "Domain"),
        (OBJECT_TYPE_EVENT, "Event"),
        (OBJECT_TYPE_OFFER, "Offer"),
        (OBJECT_TYPE_PAGE, "Page"),
        (OBJECT_TYPE_PHOTO, "Photo"),
        (OBJECT_TYPE_SHARE, "Share"),
        (OBJECT_TYPE_STATUS, "Status"),
        (OBJECT_TYPE_STORE_ITEM, "Store Item"),
        (OBJECT_TYPE_VIDEO, "Video"),
        (OBJECT_TYPE_INVALID, "Invalid"),
        (OBJECT_TYPE_PRIVACY_CHECK_FAIL, "Privacy Check Fail"),
        (OBJECT_TYPE_POST_DELETED, "Post Deleted"),
    ]

    # Core fields
    id = models.CharField(primary_key=True, max_length=64, unique=True, help_text="Unique ID for an ad creative, numeric string.")
    actor = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_ad_creatives")
    ad_disclaimer_spec=models.JSONField(blank=True, null=True)
    applink_treatment = models.CharField(max_length=16, choices=APPLINK_CHOICES, blank=True, default="", help_text="Used for Dynamic Ads. Specify what action should occur if a person clicks a link in the ad, but the business' app is not installed on their device.")
    asset_feed_spec=models.JSONField(blank=True, null=True)
    authorization_category = models.CharField(max_length=16, choices=AUTH_CHOICES, blank=True, default="", help_text="Specifies whether ad was configured to be labeled as a political ad or not.")
    body = models.TextField(blank=True, default="", help_text="The body of the ad. Not supported for video post creatives")
    branded_content = models.JSONField(blank=True, null=True)
    branded_content_sponsor_page_id = models.CharField(max_length=64, blank=True, default="", help_text="ID for page representing business which runs Branded Content ads.")
    bundle_folder_id = models.CharField(max_length=64, blank=True, default="", help_text="The Dynamic Ad's bundle folder ID")
    call_to_action = models.JSONField(blank=True, null=True)
    call_to_action_type = models.CharField(max_length=32, choices=CALL_TO_ACTION_CHOICES, blank=True, default="", help_text="The type of call to action")  
    categorization_criteria = models.CharField(max_length=16, choices=CATEGORIZATION_CHOICES, blank=True, default="", help_text="The Dynamic Category Ad's categorization field, e.g. brand")
    category_media_source = models.CharField(max_length=16, choices=CATEGORY_MEDIA_CHOICES, blank=True, default="", help_text="The Dynamic Category Ad's category media source, e.g. user_generated")
    collaborative_ads_lsb_image_bank_id = models.CharField(max_length=64, blank=True, default="", help_text="Used for CPAS local delivery image bank")
    contextual_multi_ads = models.JSONField(blank=True, null=True)
    creative_sourcing_spec = models.JSONField(blank=True, null=True)
    degrees_of_freedom_spec = models.JSONField(blank=True, null=True)
    destination_set_id = models.CharField(max_length=64, blank=True, default="", help_text="The ID of the Product Set for a Destination Catalog that will be used to link with Travel Catalogs")
    dynamic_ad_voice = models.CharField(max_length=64, blank=True, default="", help_text="Used for Store Traffic Objective inside Dynamic Ads. Allows you to control the voice of your ad.")
    effective_authorization_category = models.CharField(max_length=16, choices=AUTH_CHOICES, blank=True, default="", help_text="Specifies whether ad is a political ad or not.")
    effective_instagram_media_id = models.CharField(max_length=64, blank=True, default="", help_text="The ID of an Instagram post to use in an ad")
    effective_object_story_id = models.CharField(max_length=64, blank=True, default="", help_text="The ID of a page post to use in an ad, regardless of whether it's an organic or unpublished page post.")
    enable_direct_install = models.BooleanField(default=False, help_text="Whether Direct Install should be enabled on supported devices")
    enable_launch_instant_app = models.BooleanField(default=False, help_text="Whether Instant App should be enabled on supported devices")
    facebook_branded_content = models.JSONField(blank=True, null=True, help_text="Stores fields for Facebook Branded Content")
    image_crops = models.JSONField(blank=True, null=True, help_text="Image crops for ad creative")
    image_hash = models.CharField(max_length=255, blank=True, default="", help_text="Image hash for ad creative. If provided, do not add image_url.")
    image_url = models.CharField(max_length=512, blank=True, default="", help_text="A URL for the image for this creative.")
    instagram_permalink_url = models.CharField(max_length=512, blank=True, default="", help_text="URL for a post on Instagram you want to run as an ad.")
    instagram_user_id = models.CharField(max_length=64, blank=True, default="")
    interactive_components_spec = models.JSONField(blank=True, null=True, help_text="Interactive components spec for ad creative")
    link_destination_display_url = models.CharField(max_length=512, blank=True, default="", help_text="Overwrites the display URL for link ads when object_url is set to a click tag")
    link_og_id = models.CharField(max_length=64, blank=True, default="", help_text="The Open Graph (OG) ID for the link in this creative if the landing page has OG tags")
    link_url = models.CharField(max_length=512, blank=True, default="", help_text="Identify a specific landing tab on your Facebook page by the Page tab's URL.")
    media_sourcing_spec = models.JSONField(blank=True, null=True, help_text="media sourcing spec to allow advertisers to specify additional media from various sources.")
    messenger_sponsored_message = models.CharField(max_length=512, blank=True, default="", help_text="Used for Messenger sponsored message. JSON string with message for this ad creative.")
    name = models.CharField(max_length=255, help_text="Name of this ad creative as seen in the ad account's library.")
    object_id = models.CharField(max_length=64, blank=True, default="", help_text="ID for Facebook object being promoted with ads or relevant to the ad or ad type.")
    object_store_url = models.CharField(max_length=512, blank=True, default="", help_text="iTunes or Google Play of the destination of an app ad")
    object_story_id = models.CharField(max_length=64, blank=True, default="", help_text="ID of a Facebook Page post to use in an ad.")
    object_type = models.CharField(max_length=32, choices=OBJECT_TYPE_CHOICES, blank=True, default="", help_text="The type of Facebook object you want to advertise.")
    object_url = models.CharField(max_length=512, blank=True, default="", help_text="URL that opens if someone clicks your link on a link ad.")
    page_welcome_message = models.CharField(max_length=512, blank=True, default="")
    photo_album_source_object_story_id = models.CharField(max_length=64, blank=True, default="")
    place_page_set_id = models.CharField(max_length=64, blank=True, default="", help_text="The ID of the page set for this creative.")
    platform_customizations = models.JSONField(blank=True, null=True, help_text="Platform customization for ad creative")
    playable_asset_id = models.CharField(max_length=64, blank=True, default="", help_text="The ID of the playable asset in this creative")
    portrait_customizations = models.JSONField(blank=True, null=True, help_text="This field describes the rendering customizations selected for portrait mode ads like IG Stories, FB Stories, IGTV, etc")
    product_data = models.JSONField(blank=True, null=True)
    product_set_id = models.CharField(max_length=64, blank=True, default="", help_text="Used for Dynamic Ad. An ID for a product set, which groups related products or other items being advertised.")
    recommender_settings = models.JSONField(blank=True, null=True, help_text="Used for Dynamic Ads. Settings to display Dynamic ads based on product recommendations.")
    referral_id = models.CharField(max_length=64, blank=True, default="")
    source_facebook_post_id = models.CharField(max_length=64, blank=True, default="")
    source_instagram_media_id = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, help_text="Status of the ad creative")
    template_url = models.CharField(max_length=512, blank=True, default="", help_text="Used for Dynamic Ads when you want to use third-party click tracking.")
    template_url_spec = models.JSONField(blank=True, null=True, help_text="Template URL spec for ad creative")
    threads_user_id = models.CharField(max_length=64, blank=True, default="")
    thumbnail_id = models.CharField(max_length=64, blank=True, default="")
    thumbnail_url = models.CharField(max_length=512, blank=True, default="", help_text="URL for a thumbnail image for this ad creative.")
    title = models.CharField(max_length=255, blank=True, default="", help_text="Title for link ad, which does not belong to a page.")
    url_tags = models.CharField(max_length=512, blank=True, default="", help_text="A set of query string parameters which will replace or be appended to urls clicked from page post ads.")
    user_page_actor_override = models.BooleanField(default=False, help_text="Used for App Ads. If true, we display the Facebook page associated with the app ads.")
    video_id = models.CharField(max_length=64, blank=True, default="", help_text="Facebook object ID for video in this ad creative.")
    media_campaign = models.ForeignKey(
        'campaign.Campaign',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='facebook_ad_creatives',
    )

    # Adlabels
    ad_labels = models.ManyToManyField(AdLabel, related_name="creatives", blank=True)

    # ObjectStorySpec
    object_story_spec_instagram_user_id = models.CharField(max_length=64, blank=True, default="")
    object_story_spec_link_data = models.ForeignKey(AdCreativeLinkData, on_delete=models.SET_NULL, null=True, blank=True, related_name="link_data_ad_creatives")
    object_story_spec_page_id = models.CharField(max_length=64, blank=True, default="")
    object_story_spec_photo_data = models.ManyToManyField(AdCreativePhotoData, blank=True, related_name="photo_data_ad_creatives")
    object_story_spec_product_data = ArrayField(models.JSONField(blank=True, null=True), help_text="Product data for a dynamic ad", blank=True, null=True)
    object_story_spec_text_data = models.ForeignKey(AdCreativeTextData, on_delete=models.SET_NULL, null=True, blank=True, related_name="text_data_ad_creatives")
    object_story_spec_video_data = models.ManyToManyField(AdCreativeVideoData, blank=True, related_name="video_data_ad_creatives")
    object_story_spec_template_data = models.ForeignKey(AdCreativeLinkData, on_delete=models.SET_NULL, null=True, blank=True, related_name="template_data_ad_creatives")

    def __str__(self) -> str:
        return f"{self.id} - {self.name}"

# 8. AdCreativePreview
class AdCreativePreview(models.Model):
    # Status choices
    OFFLINE = 'Offline'
    ACTIVE = 'Active'
    STATUS_CHOICES = [
        (OFFLINE, 'Offline'),
        (ACTIVE, 'Active'),
    ]
    # days active choices
    DAYS_ACTIVE_CHOICES = [
        (7, '7'),
        (14, '14'),
        (30, '30'),
    ]
    link = models.CharField(max_length=512, help_text="Link to the ad creative preview")
    ad_creative = models.ForeignKey(AdCreative, on_delete=models.CASCADE, related_name="owned_previews", null=True, blank=True)
    token = models.CharField(max_length=64, unique=True, help_text="Token to access the ad creative preview")
    expires_at = models.DateTimeField(null=False, blank=False, help_text="Expiration date of the preview")
    json_spec = models.JSONField(blank=True, null=True, help_text="JSON spec for the ad creative preview")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=ACTIVE, help_text="Status of the ad creative preview")
    days_active = models.IntegerField(choices=DAYS_ACTIVE_CHOICES, default=30, help_text="Days active of the ad creative preview")
    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['ad_creative'],
                name='unique_preview_per_ad_creative'
            )
        ]
    
    def __str__(self) -> str:
        return f"Preview for {self.ad_creative.name if self.ad_creative else 'Unknown'} - {self.status}"