document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab')
  const screens = document.querySelectorAll('.screen')
  const app = document.querySelector('.app')
  const tabbar = document.querySelector('.tabbar')
  const cartBadge = document.getElementById('cart-badge')
  const toast = document.getElementById('toast')
  const productGrid = document.getElementById('product-grid')
  const categoriesStrip = document.querySelector('.categories')
  const overlay = document.querySelector('.overlay')
  const drawerClose = document.querySelector('.drawer-close')
  const searchInput = document.getElementById('search-input')
  const searchList = document.getElementById('search-list')
  const clearSearch = document.querySelector('.clear-search')
  const cartItemsContainer = document.getElementById('cart-items')
  const cartEmpty = document.getElementById('cart-empty')
  const cartSummary = document.getElementById('cart-summary')
  const cartTotal = document.getElementById('cart-total')
  const emptyCartButton = document.querySelector('.cart-empty-button')
  const profileName = document.querySelector('.profile-name')
  const profileEmail = document.querySelector('.profile-email')
  const profileEditName = document.getElementById('profile-edit-name')
  const profileEditEmail = document.getElementById('profile-edit-email')
  const profileEditForm = document.getElementById('profile-edit-form')
  const helpChatWindow = document.getElementById('help-chat-window')
  const helpChatForm = document.getElementById('help-chat-form')
  const helpChatInput = document.getElementById('help-chat-input')
  // Колокольчики в верхнем хедере → экран уведомлений
  const headerNotificationButtons = document.querySelectorAll('.topbar .icon-button')
  const notificationsDrawerLink = document.querySelector('.drawer-link[data-screen="notifications"]')

  if (notificationsDrawerLink && headerNotificationButtons.length > 0) {
    headerNotificationButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // используем уже настроенную логику перехода из бургер-меню
        notificationsDrawerLink.click()
      })
    })
  }

    function saveFeedback(feedbackData) {
      const payload = {
        ...feedbackData,
        page: document.querySelector('.screen.active')?.id || '',
        userAgent: navigator.userAgent
      }

      const scriptUrl = 'https://script.google.com/macros/s/AKfycbyPy0OAmi8KQHJ8Qe_1DS33FUcpSY5STW6RxcU5bzSS2q67XClO_Jhd3bBNGxONGVp3/exec'

      // можно параллельно хранить локально, если хочешь
      try {
          const key = 'uscFeedback'
          const existing = JSON.parse(localStorage.getItem(key) || '[]')
          existing.push({
            ...payload,
            savedAt: new Date().toISOString()
          })
          localStorage.setItem(key, JSON.stringify(existing))
        } catch (e) {
          console.log('localStorage error', e)
        }

        // отправляем в Google Sheets
        fetch(scriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }).catch(err => {
          console.log('feedback send error', err)
      })
    }

  const checkoutButton = document.querySelector('.cart-checkout')

  const orderModal = document.getElementById('order-modal')
  const orderModalSpinner = document.getElementById('order-modal-spinner')
  const orderModalTitle = document.getElementById('order-modal-title')
  const orderModalText = document.getElementById('order-modal-text')
  const orderModalClose = document.getElementById('order-modal-close')

  const openOrderModal = () => {
    if (!orderModal) return
    orderModal.classList.add('show')
  }

  const closeOrderModal = () => {
    if (!orderModal) return
    orderModal.classList.remove('show')
  }

  if (orderModalClose) {
    orderModalClose.addEventListener('click', () => {
      closeOrderModal()
    })
  }

  if (orderModal) {
    orderModal.addEventListener('click', e => {
      // закрываем по клику на фон, но только когда уже нет спиннера
      if (e.target === orderModal && orderModalSpinner && orderModalSpinner.style.display === 'none') {
        closeOrderModal()
      }
    })
  }

  if (checkoutButton) {
    checkoutButton.addEventListener('click', () => {
      if (!cart || cart.length === 0) {
        showToast('Корзина пока пуста')
        return
      }

      openOrderModal()

      if (orderModalSpinner) orderModalSpinner.style.display = 'block'
      if (orderModalClose) orderModalClose.classList.add('hidden')
      if (orderModalTitle) orderModalTitle.textContent = 'Обработка заказа...'
      if (orderModalText) {
        orderModalText.textContent = 'Мы проверяем товары и формируем заказ'
      }

      setTimeout(() => {


        if (orderModalSpinner) orderModalSpinner.style.display = 'none'
        if (orderModalTitle) orderModalTitle.textContent = 'Заказ оформлен'
        if (orderModalText) {
          orderModalText.textContent =
            'В финальной версии USC здесь будет подробный сценарий с трекингом доставки и деталями заказа.'
        }
        if (orderModalClose) orderModalClose.classList.remove('hidden')
        cart = []
        renderCart()
      }, 2000)

    })
  }




  const PRODUCTS = {
    meat: [
      { name: 'Мраморная говядина', seller: 'Умар', price: 780, rating: '4.9', reviews: 85, image: 'media/card_meat1.jpg' },
      { name: 'Рёбрышки', seller: 'Prime Meat', price: 950, rating: '4.8', reviews: 64, image: 'media/card_meat2.jpg' },
      { name: 'Куриные грудки', seller: 'Local Farm', price: 420, rating: '4.7', reviews: 37, image: 'media/card_meat3.jpg' },
      { name: 'Фарш говяжий', seller: 'Алтын Эт', price: 650, rating: '4.6', reviews: 28, image: 'media/card_meat4.jpg' },
      { name: 'Баранина на кости', seller: 'Nomad Meat', price: 730, rating: '4.8', reviews: 52, image: 'media/card_meat5.jpg' },
      { name: 'Оптовые поставки мяса', seller: 'USC партнёр', price: 0, rating: '5.0', reviews: 12, image: 'media/card_meat6.jpg' }
    ],
    milk: [
      { name: 'Молоко 3.2%', seller: 'FreshMilk', price: 65, rating: '4.9', reviews: 93, image: 'media/card_milk1.jpg' },
      { name: 'Домашний кефир', seller: 'Village Farm', price: 70, rating: '4.7', reviews: 41, image: 'media/card_milk2.jpg' },
      { name: 'Сметана 20%', seller: 'Dairy Pro', price: 85, rating: '4.8', reviews: 56, image: 'media/card_milk3.jpg' },
      { name: 'Творог зерненый', seller: 'Eco Milk', price: 110, rating: '4.6', reviews: 33, image: 'media/card_milk4.jpg' },
      { name: 'Йогурт питьевой', seller: 'City Dairy', price: 55, rating: '4.5', reviews: 27, image: 'media/card_milk5.jpg' },
      { name: 'Молочные поставки', seller: 'USC партнёр', price: 0, rating: '4.9', reviews: 18, image: 'media/card_milk6.jpg' }
    ],
    fish: [
      { name: 'Форель охлажденная', seller: 'Ocean Foods', price: 920, rating: '4.9', reviews: 47, image: 'media/card_fish1.jpg' },
      { name: 'Филе лосося', seller: 'Nordic Fish', price: 1150, rating: '4.8', reviews: 39, image: 'media/card_fish2.jpg' },
      { name: 'Судак потрошеный', seller: 'Issyk-Kul Fish', price: 680, rating: '4.7', reviews: 24, image: 'media/card_fish3.jpg' },
      { name: 'Карась свежий', seller: 'Local Fisher', price: 340, rating: '4.5', reviews: 19, image: 'media/card_fish4.jpg' },
      { name: 'Креветки 90/120', seller: 'Sea Market', price: 780, rating: '4.6', reviews: 31, image: 'media/card_fish5.jpg' },
      { name: 'Оптовые морепродукты', seller: 'USC партнёр', price: 0, rating: '4.9', reviews: 14, image: 'media/card_fish6.jpg' }
    ],
    bread: [
      { name: 'Хлеб пшеничный', seller: 'Bakery 24', price: 25, rating: '4.8', reviews: 80, image: 'media/card_bread1.jpg' },
      { name: 'Лепёшка тандырная', seller: 'Orient Bakery', price: 30, rating: '4.9', reviews: 67, image: 'media/card_bread2.jpg' },
      { name: 'Багет классический', seller: 'French Corner', price: 45, rating: '4.7', reviews: 29, image: 'media/card_bread3.jpg' },
      { name: 'Цельнозерновой хлеб', seller: 'Healthy Bake', price: 55, rating: '4.6', reviews: 22, image: 'media/card_bread4.jpg' },
      { name: 'Круассаны сливочные', seller: 'Morning Cafe', price: 90, rating: '4.9', reviews: 51, image: 'media/card_bread5.jpg' },
      { name: 'Оптовые хлебобулочные', seller: 'USC партнёр', price: 0, rating: '4.8', reviews: 17, image: 'media/card_bread6.jpg' }
    ],
    fruit: [
      { name: 'Яблоки красные', seller: 'Green Market', price: 80, rating: '4.8', reviews: 60, image: 'media/card_fruit1.jpg' },
      { name: 'Морковь молодая', seller: 'Village Agro', price: 45, rating: '4.7', reviews: 34, image: 'media/card_fruit2.jpg' },
      { name: 'Картофель мытый', seller: 'Agro Plus', price: 38, rating: '4.6', reviews: 29, image: 'media/card_fruit3.jpg' },
      { name: 'Огурцы тепличные', seller: 'Fresh Line', price: 75, rating: '4.5', reviews: 21, image: 'media/card_fruit4.jpg' },
      { name: 'Помидоры розовые', seller: 'Sun Farm', price: 95, rating: '4.7', reviews: 32, image: 'media/card_fruit5.jpg' },
      { name: 'Оптовые овощи и фрукты', seller: 'USC партнёр', price: 0, rating: '4.9', reviews: 19, image: 'media/card_fruit6.jpg' }
    ],
    grain: [
      { name: 'Пшеница продовольственная', seller: 'Agro Export', price: 26, rating: '4.8', reviews: 40, image: 'media/card_grain1.jpg' },
      { name: 'Рис узбекский длиннозёрный', seller: 'Asia Grain', price: 70, rating: '4.7', reviews: 33, image: 'media/card_grain2.jpg' },
      { name: 'Гречка ядрица', seller: 'Eco Grain', price: 85, rating: '4.9', reviews: 28, image: 'media/card_grain3.jpg' },
      { name: 'Овсяные хлопья', seller: 'Healthy Grain', price: 60, rating: '4.6', reviews: 25, image: 'media/card_grain4.jpg' },
      { name: 'Комбикорм', seller: 'Feed Pro', price: 48, rating: '4.5', reviews: 18, image: 'media/card_grain5.jpg' },
      { name: 'Зерновые поставки', seller: 'USC партнёр', price: 0, rating: '4.9', reviews: 16, image: 'media/card_grain6.jpg' }
    ]
  }

  let cart = []
  let currentCategory = 'meat'

  let toastTimeout
  const tabArray = Array.from(tabs)
  let indicator = null
  let indicatorStep = 0

  function moveIndicator(index) {
    if (!indicator) return
    indicator.style.transform = `translateX(${indicatorStep * index}px)`
  }

  // синхронизируем активный таб с id экрана
  function setActiveTabByScreenId(screenId) {
    const key = screenId.replace('screen-', '') // screen-home -> home
    tabs.forEach((tab, i) => {
      const isActive = tab.dataset.screen === key
      tab.classList.toggle('active', isActive)
      if (isActive) moveIndicator(i)
    })
  }

  function initIndicator() {
    if (!tabbar || !tabArray.length) return

    indicator = document.createElement('div')
    indicator.className = 'tabbar-indicator'
    tabbar.appendChild(indicator)

    const recalcStep = () => {
      const availableWidth = tabbar.clientWidth - 8
      indicatorStep = availableWidth / tabArray.length
    }

    recalcStep()

    window.addEventListener('resize', () => {
      if (!indicator) return
      recalcStep()

      const activeIndex = Math.max(
        0,
        tabArray.findIndex(t => t.classList.contains('active'))
      )
      moveIndicator(activeIndex)
    })

    // начальная позиция индикатора
    const initialScreenId =
      document.querySelector('.screen.active')?.id || 'screen-home'
    setActiveTabByScreenId(initialScreenId)
  }

  // открытие экранов (tabbar / бургер)
  function openCustomScreen(screenId, fromDrawer = false) {
    screens.forEach(screen => {
      screen.classList.toggle('active', screen.id === screenId)
    })

    if (fromDrawer) {
      // из бургера подсветку убираем
      tabs.forEach(tab => tab.classList.remove('active'))
      if (indicator) indicator.classList.add('hidden')
    } else {
      // из таббара подсветку включаем и двигаем
      if (indicator) indicator.classList.remove('hidden')
      setActiveTabByScreenId(screenId)
    }
  }

  // обработчики на таббар
  function initTabs() {
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.screen
        if (!target) return
        openCustomScreen(`screen-${target}`, false)
      })
    })
  }


  function renderProducts(category) {
    if (!productGrid) return
    const items = PRODUCTS[category] || []
    productGrid.innerHTML = ''
    items.forEach(product => {
      const article = document.createElement('article')
      article.className = 'product-card'
      const priceText = product.price > 0 ? `${product.price} сом` : 'по запросу'
      article.innerHTML = `
        <img src="${product.image}" alt="${product.name}" class="product-image">
        <div class="product-body">
          <div class="product-price-row">
            <div class="product-price">${priceText}</div>
          </div>
          <div class="product-name">${product.name}</div>
          <div class="product-seller">${product.seller}</div>
          <div class="product-rating">
            <span>★ ${product.rating}</span>
            <span class="muted">· ${product.reviews} оценок</span>
          </div>
          <button
            class="primary-button add-to-cart"
            data-name="${product.name}"
            data-price="${product.price}"
            data-image="${product.image}"
          >
            В корзину
          </button>
        </div>
      `
      productGrid.appendChild(article)
    })
    bindCartButtons()
  }

  function renderCart() {
    if (!cartItemsContainer || !cartEmpty || !cartSummary || !cartTotal) return
    cartItemsContainer.innerHTML = ''
    if (cart.length === 0) {
      cartEmpty.classList.remove('hidden')
      cartSummary.classList.add('hidden')
      cartTotal.textContent = '0 сом'
      updateCartBadge()
      return
    }
    cartEmpty.classList.add('hidden')
    cartSummary.classList.remove('hidden')
    let total = 0
    cart.forEach((item, index) => {
      const row = document.createElement('div')
      row.className = 'cart-item'
      const img = document.createElement('img')
      img.className = 'cart-item-image'
      img.src = item.image
      img.alt = item.name
      const info = document.createElement('div')
      info.className = 'cart-item-info'
      const title = document.createElement('div')
      title.className = 'cart-item-title'
      title.textContent = item.name
      const price = document.createElement('div')
      price.className = 'cart-item-price'
      price.textContent = item.price > 0 ? `${item.price} сом` : 'по запросу'
      info.appendChild(title)
      info.appendChild(price)
      const remove = document.createElement('button')
      remove.className = 'cart-item-remove'
      remove.textContent = '×'
      remove.addEventListener('click', () => {
        cart.splice(index, 1)
        renderCart()
      })
      row.appendChild(img)
      row.appendChild(info)
      row.appendChild(remove)
      cartItemsContainer.appendChild(row)
      total += item.price
    })
    cartTotal.textContent = `${total} сом`
    updateCartBadge()
  }

  function bindCartButtons() {
    const addButtons = document.querySelectorAll('.add-to-cart')
    addButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name
        const price = Number(btn.dataset.price || 0)
        const image = btn.dataset.image || ''
        cart.push({ name, price, image })
        renderCart()
        showToast('Добавлено в корзину')
      })
    })
  }

  function updateCartBadge() {
    if (!cartBadge) return
    const count = cart.length
    if (count === 0) {
      cartBadge.classList.remove('show')
      cartBadge.textContent = '0'
    } else {
      cartBadge.textContent = String(count)
      cartBadge.classList.add('show')
    }
  }

  function showToast(message) {
    if (!toast) return
    toast.textContent = message
    toast.classList.add('show')
    clearTimeout(toastTimeout)
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show')
    }, 1400)
  }

  function initCategories() {
    if (!categoriesStrip) return
    const originalItems = Array.from(categoriesStrip.children)
    if (!categoriesStrip.dataset.cloned) {
      for (let i = 0; i < 2; i++) {
        originalItems.forEach(node => {
          const clone = node.cloneNode(true)
          categoriesStrip.appendChild(clone)
        })
      }
      categoriesStrip.dataset.cloned = '1'
    }
    setTimeout(() => {
      const third = categoriesStrip.scrollWidth / 3
      categoriesStrip.scrollLeft = third
    }, 0)
    categoriesStrip.addEventListener('scroll', () => {
      const third = categoriesStrip.scrollWidth / 3
      if (categoriesStrip.scrollLeft < third * 0.3) {
        categoriesStrip.scrollLeft += third
      } else if (categoriesStrip.scrollLeft > third * 1.7) {
        categoriesStrip.scrollLeft -= third
      }
    })
    categoriesStrip.addEventListener('click', e => {
      const btn = e.target.closest('.category')
      if (!btn) return
      if (btn.classList.contains('category-search')) {
        const searchTab = document.querySelector('.tab[data-screen="search"]')
        if (searchTab) searchTab.click()
        return
      }
      const cat = btn.dataset.category
      if (!cat) return
      currentCategory = cat
      const allButtons = categoriesStrip.querySelectorAll('.category[data-category]')
      allButtons.forEach(b => b.classList.toggle('active', b === btn))
      renderProducts(currentCategory)
    })
  }

  function initSearch() {
    if (!searchInput || !searchList || !clearSearch) return
    searchInput.addEventListener('input', () => {
      const value = searchInput.value.toLowerCase().trim()
      const items = searchList.querySelectorAll('li')
      items.forEach(li => {
        const text = li.textContent.toLowerCase()
        li.style.display = text.includes(value) ? 'flex' : 'none'
      })
    })
    clearSearch.addEventListener('click', () => {
      searchInput.value = ''
      const items = searchList.querySelectorAll('li')
      items.forEach(li => {
        li.style.display = 'flex'
      })
    })
  }

  function closeDrawer() {
    app.classList.remove('drawer-open')
  }

  function openDrawer() {
    app.classList.add('drawer-open')
  }

  function initDrawer() {
    const burgers = document.querySelectorAll('.burger')
    burgers.forEach(btn => {
      btn.addEventListener('click', openDrawer)
    })
    if (overlay) overlay.addEventListener('click', closeDrawer)
    if (drawerClose) drawerClose.addEventListener('click', closeDrawer)
  }

  function initDrawerMenuLinks() {
    const links = document.querySelectorAll('.drawer-link')
    if (!links.length) return
    links.forEach(link => {
      link.addEventListener('click', () => {
        const target = link.dataset.screen
        if (!target) return
        openCustomScreen(`screen-${target}`, true)
        closeDrawer()
      })
    })
  }

  function initEmptyCartButton() {
    if (!emptyCartButton) return
    emptyCartButton.addEventListener('click', () => {
      const homeTab = document.querySelector('.tab[data-screen="home"]')
      if (homeTab) homeTab.click()
    })
  }

  function initProfileEditForm() {
    if (!profileEditForm || !profileEditName || !profileEditEmail || !profileName || !profileEmail) return
    profileEditName.value = profileName.textContent.trim()
    profileEditEmail.value = profileEmail.textContent.trim()
    profileEditForm.addEventListener('submit', e => {
      e.preventDefault()
      const newName = profileEditName.value.trim()
      const newEmail = profileEditEmail.value.trim()
      if (newName) profileName.textContent = newName
      if (newEmail) profileEmail.textContent = newEmail
      showToast('Профиль обновлён')
      const profileTab = document.querySelector('.tab[data-screen="profile"]')
      if (profileTab) profileTab.click()
    })
  }

  function addHelpMessage(type, text, meta) {
    if (!helpChatWindow) return
    const wrapper = document.createElement('div')
    wrapper.className = `help-chat-message ${type}`
    wrapper.innerHTML = `
      <div>${text}</div>
      ${meta ? `<div class="help-chat-meta">${meta}</div>` : ''}
    `
    helpChatWindow.appendChild(wrapper)
    helpChatWindow.scrollTop = helpChatWindow.scrollHeight
  }

  function initHelpChat() {
    if (!helpChatWindow || !helpChatForm || !helpChatInput) return
    if (!helpChatWindow.dataset.inited) {
      addHelpMessage(
        'incoming',
        'Здравствуйте, это поддержка USC. Напишите, если нужна помощь с заказами или поставщиками.',
        'USC Support'
      )
      addHelpMessage(
        'outgoing',
        'Добрый день, мы тестируем экран помощи в рамках MVP. Поддержите проект!',
        'Вы'
      )
      helpChatWindow.dataset.inited = '1'
    }
    helpChatForm.addEventListener('submit', e => {
      e.preventDefault()
      const text = helpChatInput.value.trim()
      if (!text) return
      addHelpMessage('outgoing', text, 'Вы')
      helpChatInput.value = ''
      setTimeout(() => {
        addHelpMessage(
          'incoming',
          'Спасибо за вопрос. В полной версии приложения здесь будет живой оператор или AI-помощник.',
          'USC Support'
        )
      }, 500)
    })
  }

  function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item')
    if (!faqItems.length) return
    faqItems.forEach(item => {
      const question = item.querySelector('.faq-question')
      if (!question) return
      question.addEventListener('click', () => {
        item.classList.toggle('open')
      })
    })
  }

  initIndicator()
  initTabs()
  initCategories()
  initSearch()
  initDrawer()
  initDrawerMenuLinks()
  initEmptyCartButton()
  initProfileEditForm()
  initHelpChat()
  initFaqAccordion()
  renderProducts(currentCategory)
  renderCart()







    const feedbackButton = document.getElementById('feedback-button')
  const feedbackBubble = document.getElementById('feedback-bubble')
  const feedbackModal = document.getElementById('feedback-modal')
  const feedbackForm = document.getElementById('feedback-form')
  const feedbackCancel = document.getElementById('feedback-cancel')
  const feedbackStars = document.querySelectorAll('.feedback-star')
  let feedbackRating = 0

  const openFeedbackModal = () => {
    if (!feedbackModal) return
    feedbackModal.classList.add('show')
  }

  const closeFeedbackModal = () => {
    if (!feedbackModal) return
    feedbackModal.classList.remove('show')
  }

  const setFeedbackRating = value => {
    feedbackRating = value
    feedbackStars.forEach(star => {
      const v = Number(star.dataset.value || 0)
      star.classList.toggle('active', v <= feedbackRating)
    })
  }

  if (feedbackStars && feedbackStars.length > 0) {
    feedbackStars.forEach(star => {
      star.addEventListener('click', () => {
        const v = Number(star.dataset.value || 0)
        setFeedbackRating(v)
      })
    })
  }

  if (feedbackButton) {
    feedbackButton.addEventListener('click', () => {
      openFeedbackModal()
    })
  }

  if (feedbackBubble) {
    feedbackBubble.addEventListener('click', () => {
      openFeedbackModal()
    })
  }

  if (feedbackCancel) {
    feedbackCancel.addEventListener('click', () => {
      closeFeedbackModal()
    })
  }

  if (feedbackModal) {
    feedbackModal.addEventListener('click', e => {
      if (e.target === feedbackModal) {
        closeFeedbackModal()
      }
    })
  }

  if (feedbackForm) {
    feedbackForm.addEventListener('submit', e => {
      e.preventDefault()

      if (feedbackRating === 0) {
        showToast('Поставьте оценку по звездам')
        return
      }

      const like = document.getElementById('feedback-like')?.value.trim() || ''
      const miss = document.getElementById('feedback-miss')?.value.trim() || ''
      const ideas = document.getElementById('feedback-ideas')?.value.trim() || ''

    const feedbackData = {
      rating: feedbackRating,
      like,
      miss,
      ideas,
      page: document.querySelector('.screen.active')?.id || '',
      screen: `${window.innerWidth}x${window.innerHeight}`,
      userAgent: navigator.userAgent
    }



      saveFeedback(feedbackData)

      // очищаем форму как раньше
      setFeedbackRating(0)
      if (document.getElementById('feedback-like')) document.getElementById('feedback-like').value = ''
      if (document.getElementById('feedback-miss')) document.getElementById('feedback-miss').value = ''
      if (document.getElementById('feedback-ideas')) document.getElementById('feedback-ideas').value = ''

      closeFeedbackModal()
      showToast('Спасибо за отзыв')
    })
  }

  if (feedbackBubble) {
    const showBubble = () => {
      feedbackBubble.classList.add('show')
      setTimeout(() => {
        feedbackBubble.classList.remove('show')
      }, 2800)
    }

    setTimeout(showBubble, 6000)
    setInterval(showBubble, 20000)
    }

})
