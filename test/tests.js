// import 'es.js'
const { World } = require('../index.js')
const { Entity } = require('../src/entity.js')
const { assert, expect } = require('chai')
const { SimpleIndex } = require('../src/simple_index.js')
const { MemoizedQueryIndex } = require('../src/memoized_query_index.js')
const indexers = [SimpleIndex, MemoizedQueryIndex]

function getSize(it) {
	let num = 0
	for (let elem of it) {
		++num
	}
	return num
}

function has(it, target) {
	for (let elem of it) {
		if (elem.toString() == target.toString()) {
			return true
		}
	}
	return false
}

function test(callback) {
	return function() {
		for (let indexer of indexers) {
			callback(new World(indexer))
		}
	}
}

describe('World', function() {
	describe('component()', function() {
		it('define a component', test(function(world) {
			world.component('position', function(entity, x = 0, y = 0) {
				this.x = x
				this.y = y

				this.inc = (a) => {
					return a + 1
				}
			})
			let ent = world.entity().set('position', 1, 2)
			assert('position' in world.components)
			assert(Object.keys(world.components).length == 1)
			assert(ent.has('position'))
			assert(ent.get('position').x === 1)
			assert(ent.get('position').y === 2)
			assert(ent.get('position').inc(5) === 6)

			// Using class syntax
			world.component('velocity', class {
				constructor(entity, x = 0, y = 0) {
					this.x = x
					this.y = y
				}

				inc(a) {
					return a + 1
				}
			})
			let ent2 = world.entity().set('velocity', 1, 2)
			assert('velocity' in world.components)
			assert(Object.keys(world.components).length == 2)
			assert(ent2.has('velocity'))
			assert(ent2.get('velocity').x === 1)
			assert(ent2.get('velocity').y === 2)
			assert(ent2.get('velocity').inc(5) === 6)

			// Should throw when calling "components" setter
			expect(() => (ent2.components = ['anything'])).to.throw()
		}))
		it('README example', test(function(world) {
			// Create player
			let player = world.entity().set('health', { value: 100 })

			// Create enemies
			world.entity().set('damages', 10)
			world.entity().set('damages', 30)

			// Apply damage
			world.every(['damages'], (amount) => {
				player.get('health').value -= amount
			})

			// Player now has reduced health
			assert(player.get('health').value === 60)
		}))
		it('define an object component (should be invalid)', test(function(world) {
			let result = world.component('position', {
				x: 0,
				y: 0
			})
			assert(result === undefined)
			let result2 = world.component('invalid', 555)
			assert(result2 === undefined)
			assert(Object.keys(world.components).length === 0)
		}))
		it('define an empty component', test(function(world) {
			let result = world.component('position')
			assert(result === undefined)
		}))
		it('use an empty component', test(function(world) {
			let ent = world.entity().update('position', {
				x: 1
			})
			assert(ent.has('position'))
			assert(ent.get('position').x === 1)

			let ent2 = world.entity().set('velocity', {
				x: 2
			})
			assert(ent2.has('velocity'))
			assert(ent2.get('velocity').x === 2)
			ent2.set('velocity', {
				y: 3
			})
			assert(ent2.get('velocity').x === undefined)
			assert(ent2.get('velocity').y === 3)
			ent2.update('velocity', {
				x: 42
			})
			assert(ent2.get('velocity').x === 42)
			assert(ent2.get('velocity').y === 3)

			let ent3 = world.entity().set('singleValue', 5)
			assert(ent3.has('singleValue'))
			assert(ent3.get('singleValue') === 5)
			ent3.set('singleValue', 500)
			assert(ent3.get('singleValue') === 500)

			let ent4 = world.entity().set('string', 'hello')
			assert(ent4.has('string'))
			assert(ent4.get('string') === 'hello')
			ent4.set('string', 'goodbye')
			assert(ent4.get('string') === 'goodbye')

			ent4.remove('string')
			assert(!ent4.has('string'))
		}))
		it('test clearing with indexes', test(function(world) {
			world.component('position', function(entity, x = 0, y = 0) {
				this.x = x
				this.y = y
			})
			world.component('velocity')
			world.component('sprite')
			let results = world.every([])
			results = world.every(['position'])
			results = world.every(['position', 'velocity'])

			world.entity().set('position', 1, 2).set('velocity')
			world.entity().set('position', 3, 4).set('velocity')
			world.entity().set('position', 5, 6)
			world.entity().set('velocity')

			let count = 0
			world.every(['position'], (position) => {
				assert(position.x >= 1)
				assert(position.y >= 2)
				++count
			})
			assert(count === 3)

			world.clear()

			count = 0
			world.every(['position'], (position) => {
				++count
			})
			world.every([], (ent) => {
				++count
			})
			assert(count === 0)
		}))
		it('test entity creation with constructor parameters', test(function(world) {
			let when = 0
			world.component('sprite', class {
				onCreate(entity, texture, size, invalid) {
					this.entity = entity
					this.texture = texture
					this.size = size
					this.constructorCalled = ++when
					assert(texture && texture === this.texture)
					assert(size && size === this.size)
					assert(invalid === undefined)

					// Regression in 0.3.0, fixed in 0.3.1
					assert(entity.get('sprite') === this)
				}
			})

			let ent = world.entity().set('sprite', 'test.png', 100)
			assert(ent.get('sprite').constructorCalled === 1)
			assert(ent.get('sprite').entity === ent)
			assert(ent.get('sprite').texture === 'test.png')
			assert(ent.get('sprite').size === 100)

		}))
		it('test clearing with onRemove', test(function(world) {
			let spriteCount = 0
			world.component('sprite', class {
				constructor() {
					++spriteCount
				}

				onRemove() {
					--spriteCount
				}
			})

			let ent = world.entity().set('sprite')
			assert(spriteCount === 1)

			let ent2 = world.entity().set('sprite')
			assert(spriteCount === 2)

			world.clear()
			assert(spriteCount === 0)
		}))
		it('test detach and attach', test(function(world) {
			let spriteCount = 0
			world.component('sprite', class {
				constructor() {
					++spriteCount
				}

				onRemove() {
					--spriteCount
				}
			})

			let ent = world.entity().set('sprite').set('position', {x: 1})
			assert(spriteCount === 1)

			let ent2 = world.entity().set('sprite').set('position', {x: 2})
			assert(spriteCount === 2)

			// Test detaching
			assert(ent.valid())
			ent.detach()
			assert(!ent.valid())
			assert(spriteCount === 2)
			assert(world.entities.size === 1)
			assert(getSize(world.every(['position'])) === 1)
			assert(world.get('position').length === 1)
			assert(world.get('position')[0].get('position').x === 2)
			assert(ent.get('position').x === 1)

			// Test attaching
			ent.attach(world)
			assert(ent.valid())
			assert(spriteCount === 2)
			assert(world.entities.size === 2)
			assert(getSize(world.every(['position'])) === 2)
			assert(world.get('position').length === 2)
			assert(ent.get('position').x === 1)

			// Test edge cases
			ent.detach()
			assert(!ent.valid())
			ent.detach()
			assert(!ent.valid())
			ent.attach()
			assert(!ent.valid())
			ent.attach(world)
			assert(ent.valid())
		}))
		it('test detached entities', test(function(world) {
			let ent = world.entity()
				.set('sprite', {texture: 'image.png'})
				.set('position', 5)

			assert(ent.valid())
			assert(ent.has('sprite'))
			assert(ent.has('position'))
			assert(ent.get('sprite').texture === 'image.png')
			assert(ent.get('position') === 5)

			ent.detach()

			assert(!ent.valid())
			assert(ent.has('sprite'))
			assert(ent.has('position'))
			assert(ent.get('sprite').texture === 'image.png')
			assert(ent.get('position') === 5)

			ent.set('velocity', {x: 10})
			assert(ent.has('velocity'))
			assert(ent.get('velocity').x === 10)

			ent.set('position', 6)
			assert(ent.has('position'))
			assert(ent.get('position') === 6)

			ent.remove('position')
			assert(!ent.has('position'))

			// Create entity outside of the world
			let ent2 = new Entity()
			assert(!ent2.valid())
			ent2.set('velocity', {x: 30})
			ent2.set('position', 7)
			assert(ent2.has('velocity', 'position'))
			assert(ent2.get('velocity').x === 30)
			assert(ent2.get('position') === 7)
			ent2.removeAll()
			assert(!ent2.has('velocity'))
			assert(!ent2.has('position'))
		}))
	})

	describe('system()', function() {
		it('define a system', test(function(world) {
			world.component('position')
			world.system(['position'], class {})
			assert(world.systems.length == 1)
		}))
		it('define a system with arguments', test(function(world) {
			let velocitySystem = class {
				constructor(maxVelocity) {
					this.maxVelocity = maxVelocity
				}

				initialize(canvas, textures) {
					this.canvas = canvas
					this.textures = textures
				}
			}
			world.component('velocity')
			world.system(['velocity'], velocitySystem, 3500)
			assert(world.systems[0].maxVelocity === 3500)

			world.initialize('someCanvas', ['textures.png'])
			assert(world.systems[0].canvas === 'someCanvas')
			assert(world.systems[0].textures[0] === 'textures.png')
		}))
		it('system iteration', test(function(world) {
			world.component('position')
			world.component('velocity')
			world.system(['position', 'velocity'], class {
				pre(dt, total) {
					assert(dt > 0)
					assert(total > 0)
				}

				every(position, velocity, ent, dt, total) {
					assert(position)
					assert(velocity)
					position.x += velocity.x
					position.y += velocity.y
					assert(ent)
					assert(ent.has('position'))
					assert(ent.has('velocity'))
					assert(dt > 0)
					assert(total > 0)
				}

				post(dt, total) {
					assert(dt > 0)
					assert(total > 0)
				}
			})

			let dt = 0.1667
			let total = dt

			let entA = world.entity()
			let entB = world.entity()
			let entC = world.entity()
			entA.update('position', {x: 1, y: 1}).update('velocity', {x: 1, y: 0})
			entB.update('position', {x: 30, y: 40}).update('velocity', {x: -1, y: 2})

			world.initialize()

			assert(entA.get('position').x == 1 && entA.get('position').y == 1)
			assert(entB.get('position').x == 30 && entB.get('position').y == 40)

			world.run(dt, total)

			assert(entA.get('position').x == 2 && entA.get('position').y == 1)
			assert(entB.get('position').x == 29 && entB.get('position').y == 42)

			total += dt
			world.run(dt, total)

			assert(entA.get('position').x == 3 && entA.get('position').y == 1)
			assert(entB.get('position').x == 28 && entB.get('position').y == 44)
		}))
		it('system methods', test(function(world) {
			world.component('position')

			let methodsCalled = 0

			world.system(['position'], class {
				constructor() {
					this.val = 10
				}
				initialize() {
					++methodsCalled
					assert(this.val === 10)
				}
				pre() {
					++methodsCalled
					assert(this.val === 10)
				}
				every(position) {
					position.x = 1
					++methodsCalled
					assert(this.val === 10)
				}
				post() {
					++methodsCalled
					assert(this.val === 10)
				}
			})

			world.system(['invalid'], class {})
			world.system()

			let ent = world.entity().set('position')
			world.initialize()
			assert(methodsCalled == 1)
			world.run()
			assert(methodsCalled == 4)
		}))
		it('system edge cases', test(function(world) {
			world.component('position')
			world.component('velocity')

			let testEnt0 = world.entity().set('position').set('velocity')
			let testEnt2 = null
			for (let i = 0; i < 100; ++i) {
				let tmpEnt = world.entity()
				tmpEnt.set('position').set('velocity')
				if (i == 80) {
					testEnt2 = tmpEnt
				}
			}

			let testEnt1 = world.entity().set('position').set('velocity')
			let count = 0

			world.system(['position', 'velocity'], class {
				every(position, velocity, ent) {
					++count
					if (count == 1) {
						testEnt1.removeAll()
						testEnt2.remove('position')
						testEnt0.remove('velocity')
						return
					}
					assert(position)
					assert(velocity)
					position.x += velocity.x
					position.y += velocity.y
					assert(ent)
					assert(ent.has('position'))
					assert(ent.has('velocity'))

					// Make sure the test entities do not show up here
					assert(ent.id !== testEnt0.id)
					assert(ent.id !== testEnt1.id)
					assert(ent.id !== testEnt2.id)
				}
			})
			let entA = world.entity()
			let entB = world.entity()
			let entC = world.entity()
			entA.update('position', {x: 1, y: 1}).update('velocity', {x: 1, y: 0})
			entB.update('position', {x: 30, y: 40}).update('velocity', {x: -1, y: 2})

			world.initialize()

			assert(entA.get('position').x == 1 && entA.get('position').y == 1)
			assert(entB.get('position').x == 30 && entB.get('position').y == 40)

			world.run()

			assert(entA.get('position').x == 2 && entA.get('position').y == 1)
			assert(entB.get('position').x == 29 && entB.get('position').y == 42)

			world.run()

			assert(entA.get('position').x == 3 && entA.get('position').y == 1)
			assert(entB.get('position').x == 28 && entB.get('position').y == 44)
		}))
		it('adding entities to index', test(function(world) {
			world.entity().set('a').set('b')
			assert(world.get('a', 'b').length === 1)
			world.get('a', 'b')[0].destroy()
			assert(world.get('a', 'b').length === 0)
			world.entity().set('a')
			assert(world.get('a', 'b').length === 0)
			world.entity().set('b')
			assert(world.get('a', 'b').length === 0)
			world.entity().set('b').set('a')
			assert(world.get('a', 'b').length === 1)
		}))
		it('onRemove edge cases', test(function(world) {
			world.component('position', class {
				onCreate(entity, value) {
					this.entity = entity
					this.value = value
				}

				onRemove() {
					this.entity.set('somethingElse')
				}
			})

			let entity = world.entity().set('position')

			expect(() => entity.destroy()).to.throw()
		}))
		it('indexing edge cases', test(function(world) {
			// This test was to discover the "adding entities to index" and "onRemove edge cases" tests above
			// Keeping it in case there are other problems in the future

			let g = { count: 0 }

			// Define components
			world.component('position', class {
				onCreate(entity, x = 0, y = 0) {
					this.entity = entity
					this.x = x
					this.y = y
				}
			})
			world.component('velocity', class {
				onCreate(entity, x = 0, y = 0) {
					this.entity = entity
					this.x = x
					this.y = y
				}
			})
			world.component('sprite', class {
				onCreate(entity, texture) {
					this.entity = entity
					this.texture = texture
				}

				onRemove() {
					g.entity.set('sideEffect', ++g.count)
				}
			})

			const REPEAT = 3

			for (let i = 0; i < REPEAT; ++i) {

				g.count = 0

				// Create test entities
				world.entity().set('noOtherComponents', 0)
				world.entity().set('position', 1)
				g.entity = world.entity().set('velocity', 2)
				world.entity().set('sprite', 'three')
				world.entity().set('position', 4).set('velocity', 4)
				world.entity().set('position', 5).set('velocity', 5).set('sprite', 'five')
				world.entity().set('position', 6).set('sprite', 'six')
				world.entity().set('velocity', 7).set('sprite', 'seven')

				// Ensure initial indexes are good
				for (let i = 0; i < REPEAT; ++i) {
					assert(world.get('noOtherComponents').length === 1)
					assert(world.get('sideEffect').length === 0)
					assert(world.get('sprite').length === 4)
					assert(world.get('velocity').length === 4)
					assert(world.get().length === 8)
					assert(world.get('position').length === 4)
					assert(world.get('position', 'velocity').length === 2)
					assert(world.get('position', 'sprite').length === 2)
					assert(world.get('position', 'velocity', 'sprite').length === 1)
					assert(world.get('velocity', 'sprite').length === 2)
				}

				// Remove test entities, create more test entities
				let count = 0
				world.every(['sprite'], (sprite, entity) => { ++count; entity.destroy() })
				assert(count === 4)

				count = 0
				world.every(['sprite'], (sprite, entity) => { ++count; entity.destroy() })
				assert(count === 0)


				assert(g.count === 4)

				// Ensure indexes are still good
				for (let i = 0; i < REPEAT; ++i) {
					assert(world.get().length === 4)
					assert(world.get('noOtherComponents').length === 1)
					assert(world.get('sideEffect').length === 1)
					assert(world.get('sprite').length === 0)
					assert(world.get('velocity').length === 2)
					assert(world.get('position').length === 2)
				}

				count = 0
				world.every(['velocity'], (velocity, entity) => { ++count; entity.destroy() })
				assert(count === 2)

				count = 0
				world.every(['velocity'], (velocity, entity) => { ++count; entity.destroy() })
				assert(count === 0)

				// Ensure indexes are still good
				for (let i = 0; i < REPEAT; ++i) {
					assert(world.get().length === 2)
					assert(world.get('noOtherComponents').length === 1)
					assert(world.get('sideEffect').length === 0)
					assert(world.get('sprite').length === 0)
					assert(world.get('velocity').length === 0)
					assert(world.get('position').length === 1)
				}

				count = 0
				world.every(['position'], (position, entity) => { ++count; entity.destroy() })
				assert(count === 1)

				count = 0
				world.every(['position'], (position, entity) => { ++count; entity.destroy() })
				assert(count === 0)

				world.get('noOtherComponents')[0].destroy()

				// Ensure new indexes are good
				for (let i = 0; i < REPEAT; ++i) {
					assert(world.get().length === 0)
					assert(world.get('noOtherComponents').length === 0)
					assert(world.get('sideEffect').length === 0)
					assert(world.get('sprite').length === 0)
					assert(world.get('velocity').length === 0)
					assert(world.get('position').length === 0)
				}
			}
		}))
		it('system variadic arguments with optional components', test(function(world) {
			// Test optional case
			let created = false
			world.system(class {
				constructor(first, second) {
					assert(first === 1)
					assert(second === 2)
					created = true
				}
			}, 1, 2)
			assert(created)

			// Test specified case
			created = false
			world.system(['whatever'], class {
				constructor(first, second) {
					assert(first === 1)
					assert(second === 2)
					created = true
				}
			}, 1, 2)
			assert(created)
		}))
		it('use the every() method', test(function(world) {
			let ent1 = world.entity().set('position').set('"velocity"')
			let ent2 = world.entity().set('position')
			let ent3 = world.entity().set('position:"velocity"')
			let externalVar = 5
			world.every(['position'], (pos, ent) => {
				assert(pos)
				assert(ent)
				assert(ent.has('position'))
				assert(externalVar === 5)
			})
			world.every(['position'], function(pos, ent) {
				assert(pos)
				assert(ent)
				assert(ent.has('position'))
				assert(externalVar === 5)
			})

			// Test hash collisions and escaping
			world.every(['position:"velocity"'])
			let count = 0
			world.every(['position', '"velocity"'], function(pos, vel, ent) {
				assert(pos)
				assert(vel)
				assert(ent)
				assert(ent.has('position', '"velocity"'))
				++count
			})
			assert(count === 1)

			// Test iterator usage
			count = 0
			let results = world.every(['position', '"velocity"'])
			for (let ent of results) {
				++count
			}
			assert(count === 1)

			// Passing callbacks cause the return value to be undefined
			results = world.every(['position'], () => true)
			assert(results === undefined)
			results = world.every([], () => true)
			assert(results === undefined)

			// Test breaking out of the loop
			count = 0
			world.every(['position'], function(pos, ent, argA, argB, argC) {
				assert(pos)
				assert(ent)
				assert(argA === 'extra')
				assert(argB === 'args')
				assert(argC === 999)
				assert(ent.has('position'))
				++count
				return false
			}, 'extra', 'args', 999)
			assert(count === 1)

			// And just to be sure there are more than 1
			count = world.get('position').length
			assert(count === 2)
		}))
		it('test indexing with every()', test(function(world) {
			world.component('position', function(entity, val = 0) {
				this.val = val
			})
			world.component('velocity')
			world.component('sprite')
			let ent1 = world.entity().set('position', 1).set('velocity')
			let ent2 = world.entity().set('position', 10)
			let ent3 = world.entity().set('position', 100).set('velocity').set('sprite')
			let count = 0
			world.every(['position', 'velocity'], (pos, vel, ent) => {
				assert(ent.has('position', 'velocity'))
				count += pos.val
			})
			assert(count == 101)
			count = 0

			ent1.remove('position')
			ent1.set('sprite')
			ent2.set('velocity')
			world.every(['position', 'velocity'], (pos, vel, ent) => {
				assert(ent.has('position', 'velocity'))
				count += pos.val
			})
			assert(count == 110)

			ent1.remove('sprite')
			ent2.remove('sprite')
			ent3.remove('sprite')

			// Query for all entities
			let test = world.every([])
			assert(getSize(test) == 3)

			let ent4 = world.entity()
			assert(getSize(world.every([])) == 4)
			assert(has(world.every([]), ent4))

			ent4.set('velocity')
			assert(getSize(world.every([])) == 4)
			assert(has(world.every([]), ent4))

			ent4.remove('velocity')
			assert(getSize(world.every([])) == 4)
			assert(has(world.every([]), ent4))

			ent4.destroy()
			assert(getSize(world.every([])) == 3)
			assert(!has(world.every([]), ent4))

			count = 0
			world.every([], (ent) => {
				++count
			})
			assert(count == 3)

			count = 0
			world.system(class {
				every(ent) {
					++count
				}
			})
			world.run()
			assert(count == 3)
		}))
	})

	describe('entity()', function() {
		it('create an entity', test(function(world) {
			world.component('position')
			let ent = world.entity()
			assert(world.entities.size == 1)
			assert(ent.toString() == String(ent.id))
		}))
		it('test if ID is read-only', test(function(world) {
			let ent = world.entity()
			expect(() => ent.id = 5).to.throw()
			assert(typeof ent.id === 'number' && ent.id === 1)
		}))
		it('valid entities', test(function(world) {
			let entityA = world.entity().set('test')
			let entityB = world.get('test')[0]
			assert(entityA.valid())
			assert(entityB.valid())
			assert(entityA.id === entityB.id)
			assert(entityA === entityB)

			entityA.destroy()
			assert(!entityA.valid())
			assert(!entityB.valid())
		}))
		it('remove an entity', test(function(world) {
			world.component('position', function(entity, x = 0, y = 0) {
				this.x = x
				this.y = y
			})
			let ent = world.entity()
			ent.set('position')
			ent.get('position').val = 100

			assert(world.entities.size == 1)
			assert(Object.keys(world.components).length == 1)
			assert(ent.has('position'))
			assert(ent.get('position').val === 100)
			assert(ent.valid())

			ent.destroy()

			assert(world.entities.size == 0)
			assert(Object.keys(world.components).length == 1)
			assert(!ent.valid())
			assert(!ent.has('position'))

			// Just for safe measure
			ent.destroy()

			assert(world.entities.size == 0)
			assert(Object.keys(world.components).length == 1)
			assert(!ent.valid())
			assert(!ent.has('position'))
		}))
		it('get and set components', test(function(world) {
			world.component('position', function(entity, x = 0, y = 0) {
				this.x = x
				this.y = y
			})
			world.component('empty')
			let ent = world.entity()
			ent.set('position', 5)
			assert(ent.has('position'))
			assert(ent.components.length == 1)
			assert(ent.get('position').x === 5)
			assert(ent.get('position').y === 0)

			ent.update('position', {y: 3})
			assert(ent.has('position'))
			assert(ent.components.length == 1)
			assert(ent.get('position').x === 5)
			assert(ent.get('position').y === 3)

			ent.update('object', {val: 50})
			assert(ent.has('object'))
			assert(ent.components.length == 2)
			assert(ent.get('object').val === 50)

			ent.update('empty', {testing: 100})
			assert(ent.has('empty'))
			assert(ent.components.length == 3)
			assert(ent.get('empty').testing === 100)

			ent.set('anonymous')
			assert(ent.components.length == 4)
			assert(ent.has('anonymous'))

			// Access test
			ent.removeAll()
			assert(!ent.has('position'))
			ent.access('position').x = 300
			assert(ent.has('position'))
			assert(ent.get('position').x === 300)

			// Get test
			ent.removeAll()
			assert(!ent.has('position'))
			assert(ent.get('position') === undefined)
			assert(!ent.has('position'))
			ent.set('position', 333)
			assert(ent.get('position').x === 333)
			assert(ent.get('position').y === 0)

			// Undefined component tests
			ent.removeAll()
			ent.set('invalid', {a: 'test'})
			assert(ent.get('invalid').a === 'test')

			ent.set('invalid', {b: 'test2'})
			assert(ent.get('invalid').a === undefined)
			assert(ent.get('invalid').b === 'test2')

			ent.set('invalid2', 5)
			assert(ent.get('invalid2') === 5)

			ent.set('invalid2', 'test')
			assert(ent.get('invalid2') === 'test')

			ent.set('invalid2', ['test'])
			assert(ent.get('invalid2')[0] === 'test')
		}))
		it('remove components', test(function(world) {
			world.component('position')
			world.component('velocity')
			let ent = world.entity().set('position').set('velocity')
			assert(ent.components.length == 2)
			assert(ent.has('position'))
			assert(ent.has('velocity'))

			ent.remove('invalid')
			ent.remove()

			ent.remove('position')
			assert(ent.components.length == 1)
			assert(!ent.has('position'))
			assert(ent.has('velocity'))

			ent.remove('velocity')
			assert(ent.components.length == 0)
			assert(!ent.has('position'))
			assert(!ent.has('velocity'))

			ent.set('position').set('velocity')
			assert(ent.components.length == 2)
			assert(ent.has('position'))
			assert(ent.has('velocity'))
			ent.removeAll()
			assert(ent.components.length == 0)
			assert(!ent.has('position'))
			assert(!ent.has('velocity'))

			// Remove many components
			ent.set('position').set('velocity').set('testA').set('testB')
			assert(ent.components.length == 4)
			assert(ent.has('position'))
			assert(ent.has('velocity'))
			assert(ent.has('testA'))
			assert(ent.has('testB'))
			ent.remove('invalidA', 'position', 'testA', 'invalidB')
			assert(!ent.has('position'))
			assert(ent.has('velocity'))
			assert(!ent.has('testA'))
			assert(ent.has('testB'))
			ent.remove('velocity', 'testB')
			assert(!ent.has('position'))
			assert(!ent.has('velocity'))
			assert(!ent.has('testA'))
			assert(!ent.has('testB'))
		}))
		it('remove components - onRemove', test(function(world) {
			world.component('test', function(entity, obj) {
				this.obj = obj
				this.obj.created = true

				this.onRemove = () => {
					this.obj.removed = true
				}
			})
			let obj = {
				created: false,
				removed: false
			}
			let ent = world.entity().set('test', obj)
			assert(ent.has('test'))
			assert(obj.created)
			assert(!obj.removed)

			ent.remove('test')
			assert(ent.components.length == 0)
			assert(!ent.has('test'))
			assert(obj.created)
			assert(obj.removed)


			let obj2 = {
				created: false,
				removed: false
			}
			let ent2 = world.entity().set('test', obj2)
			assert(ent2.has('test'))
			assert(obj2.created)
			assert(!obj2.removed)

			ent2.destroy()
			assert(obj2.created)
			assert(obj2.removed)
		}))
		it('serialize components', test(function(world) {
			world.component('position')
			let ent = world.entity().update('position', {x: 4, y: 6})

			let data = JSON.parse(ent.toJSON())
			assert(data)
			assert(data.position)
			assert(data.position.x === 4)
			assert(data.position.y === 6)
		}))
		it('serialize custom components', test(function(world) {
			world.component('position', function(entity, x = 0, y = 0) {
				this.x = x
				this.y = y

				this.toJSON = () => {
					return {result: this.x * this.y}
				}
			})
			let ent = world.entity().set('position', 4, 6)

			let data = JSON.parse(ent.toJSON())
			assert(data)
			assert(data.position)
			assert(data.position.result === 24)
		}))
		it('deserialize components', test(function(world) {
			world.component('position')
			let ent = world.entity()
			assert(ent.components.length == 0)

			ent.fromJSON('{"position": {"x": 4, "y": 6}}')
			assert(ent.has('position'))
			assert(ent.components.length == 1)
			assert(ent.get('position'))
			assert(ent.get('position').x === 4)
			assert(ent.get('position').y === 6)
		}))
		it('deserialize custom components', test(function(world) {
			world.component('position', function(entity, x = 0, y = 0) {
				this.x = x
				this.y = y

				this.toJSON = () => {
					return {result: this.x * this.y}
				}

				this.fromJSON = (data) => {
					this.x = data.result / 2
					this.y = 2
				}
			})

			// Old deserialization test
			let ent = world.entity()
			assert(ent.components.length == 0)
			ent.fromJSON('{"position": {"result": 24}}')
			assert(ent.has('position'))
			assert(ent.components.length == 1)
			assert(ent.get('position'))
			assert(ent.get('position').x === 12)
			assert(ent.get('position').y === 2)

			// Full entity-based serialization/deserialization test
			let ent2 = world.entity().set('position', 7, 4)
			let jsonData = ent2.toJSON()
			let ent3 = world.entity().fromJSON(jsonData)
			assert(ent3.has('position'))
			assert(ent3.get('position').x === 14)
			assert(ent3.get('position').y === 2)
			ent2.fromJSON(jsonData)
			assert(ent2.has('position'))
			assert(ent2.get('position').x === 14)
			assert(ent2.get('position').y === 2)
		}))
		it('check for existence of components', test(function(world) {
			// Test all component types
			world.component('position', function(entity, x = 0, y = 0) {
				this.x = x
				this.y = y
			})
			world.component('velocity')
			world.component('player')

			let ent = world.entity()
				.set('position', 1, 2)
				.set('velocity', {x: 3, y: 4})
				.set('player')
				.set('anonymous')

			// Check for existence
			assert(ent.has('position') && ent.has('velocity') && ent.has('player') && ent.has('anonymous'))
			assert(ent.has('position', 'velocity', 'player', 'anonymous'))
			assert(!ent.has('position', 'invalid'))
			assert(!ent.has('velocity', 'invalid'))
			assert(!ent.has('player', 'invalid'))
			assert(!ent.has('anonymous', 'invalid'))
			assert(!ent.has('invalid'))

			// This behavior is important for every/systems to work properly when no components are specified
			// Basically, it should return all entities when nothing is specified
			assert(ent.has())
			let ent2 = world.entity()
			assert(ent2.has())
			assert(!ent2.has('invalid'))
		}))
		it('register and use prototypes', test(function(world) {
			// Test all three component types
			world.component('position', function(entity, x = 0, y = 0) {
				this.x = x
				this.y = y
			})

			let result = world.prototype()
			assert(result == 0)

			// Register prototypes in all ways
			result = world.prototype({Player: {
				position: {
					x: 5,
					y: 10
				},
				velocity: {
					x: 15,
					y: 20
				},
				player: {}
			}, Enemy: {
				position: {},
				velocity: {}
			}})
			assert(result == 2)

			let stringTest = JSON.stringify({Test: {
				position: {
					x: 3.14159,
					y: 5000
				}
			}})
			result = world.prototype(stringTest)
			assert(result == 1)

			// Create entities with the prototype
			let p = world.entity('Player')
			let e = world.entity('Enemy')
			let t = world.entity('Test')

			// Make sure all components exist and there are no extras
			assert(p.has('position', 'velocity', 'player'))
			assert(e.has('position', 'velocity') && !e.has('player'))
			assert(t.has('position') && !t.has('velocity') && !t.has('player'))

			// Make sure all component values are correct
			assert(p.get('position').x === 5 && p.get('position').y === 10)
			assert(p.get('velocity').x === 15 && p.get('velocity').y === 20)
			assert(p.get('player') !== undefined)
			assert(e.get('position').x === 0 && e.get('position').y === 0)
			assert(e.get('velocity').x === undefined && e.get('velocity').y === undefined)
			assert(t.get('position').x === 3.14159 && t.get('position').y === 5000)
		}))
	})
})
